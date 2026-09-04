import type { PoolClient } from 'pg'
import {
  adCooldownSecondsLeft,
  adCooldownUntil,
  adOpenRefusal,
  adViewsLeft,
  adWatchedMs,
  adWatchTooShort,
  adsConfigured,
  adsMinWatchSeconds,
  adsPostbackRequired,
  isTicketId,
  type AdProvider,
  type AdRefusal,
} from '@/domain/ads/ads'
import { ARCADE_OPEN_PLAY_TTL_MINUTES } from '@/domain/arcade/arcade'
import { economyConfig } from '@/domain/economy/economy-config'
import { resolveAdProvider } from './ad-provider'
import { isPreviewShell, query, transaction } from '../platform/db'
import { recordAdClaimSignal } from '../task/fraud'
import { isPremium } from '../premium/premium'

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"
const PG_UNIQUE_VIOLATION = '23505'

/** `entry_open_count` menjumlahkan DUA ongkos masuk yang sedang terbuka: challenge dan ronde Arena. Keduanya memotong pass lewat `consumeAdPass`, jadi keduanya sama-sama menahan tiket berikutnya — pass yang dipakai baru bisa dihidupkan lagi kalau slot `ad_views_one_ready` kosong, dan tiket baru yang keburu diklaim membuat pengembalian itu ditolak. Ronde Arena disaring umurnya karena sapuan `expireStalePlays` hanya jalan saat Arena dibuka; tanpa saringan itu satu ronde yang ditinggal akan mengunci tiket user selamanya. */
const STATE_SQL = `select
    count(*) filter (
      where (created_at at time zone 'Asia/Jakarta')::date = ${TODAY} and ready_at is not null
    )::int as views_today,
    max(created_at) filter (where ready_at is not null) as last_opened_at,
    count(*) filter (where state='pending')::int as pending_count,
    count(*) filter (where state='ready')::int as ready_count,
    max(expires_at) filter (where state='ready') as pass_expires_at,
    ((select count(*) from challenges c
       where c.user_id=$1 and c.submitted_at is null and c.ad_view_id is not null)
     + (select count(*) from arcade_plays p
         where p.user_id=$1 and p.state='open' and p.ad_view_id is not null
           and p.opened_at > now() - (${ARCADE_OPEN_PLAY_TTL_MINUTES}::int * interval '1 minute')))::int
      as entry_open_count,
    now() as now
  from ad_views where user_id=$1`

type StateRow = {
  views_today: number
  last_opened_at: Date | null
  pending_count: number
  ready_count: number
  pass_expires_at: Date | null
  entry_open_count: number
  now: Date
}

/** Diekspor untuk `settleAdPostback`: jalur itu juga menerbitkan pass, jadi ia menanggung penjagaan slot `ad_views_one_ready` yang sama dan butuh sapuan yang sama persis. Satu definisi, bukan dua yang bisa menyimpang. */
export const EXPIRE_STALE_SQL = `update ad_views set state='expired'
  where user_id=$1 and state in ('pending','ready') and expires_at <= now()`

async function run<T>(sql: string, params: unknown[], tx?: PoolClient): Promise<T[]> {
  return tx ? ((await tx.query(sql, params)).rows as T[]) : query<T>(sql, params)
}

async function readState(userId: number, tx?: PoolClient) {
  await run(EXPIRE_STALE_SQL, [userId], tx)
  const rows = await run<StateRow>(STATE_SQL, [userId], tx)
  const row = rows[0]
  const now = row ? row.now.getTime() : Date.now()
  return {
    now,
    viewsToday: row ? Number(row.views_today) : 0,
    lastOpenedAt: row?.last_opened_at ? row.last_opened_at.getTime() : null,
    hasPending: Boolean(row && Number(row.pending_count) > 0),
    hasReady: Boolean(row && Number(row.ready_count) > 0),
    hasEntryOpen: Boolean(row && Number(row.entry_open_count) > 0),
    passExpiresAt: row?.pass_expires_at ? row.pass_expires_at.getTime() : null,
  }
}

export interface AdsSessionState {
  /** Tiket iklan berhadiah: tombol opt-in yang membayar ongkos masuk satu task. */
  enabled: boolean
  /** Interstitial otomatis yang nongol sendiri tanpa diminta. Dipisah dari `enabled` karena premium hanya membeli ketenangan, bukan penghapusan jalan keluar: yang dimatikan cuma iklan yang mengganggu, sementara tiket berhadiah tetap ada supaya user premium yang energinya habis masih punya pilihan — dan impresi berhadiah itu tetap terhitung sebagai pemasukan. */
  inAppEnabled: boolean
  provider: AdProvider | null
  unitId: string | null
  viewsLeft: number
  cooldownSecondsLeft: number
  /** Tenggat cooldown sebagai timestamp, bukan cuma sisa detiknya. `cooldownSecondsLeft` adalah potret yang langsung basi begitu terkirim, jadi klien butuh titik akhirnya supaya bisa memajukan hitungan mundur sendiri — pola yang sama dipakai `energy.nextAt` dan `rewardPool.nextAt`. */
  cooldownUntil: number | null
  /** Jam server saat potret diambil, dipakai klien untuk mengoreksi selisih jam perangkat. */
  now: number
  pass: { expiresAt: number } | null
  /** Ada task ATAU ronde Arena yang dibayar tiket dan belum ditutup. `openAdTicket` menolak selama ini menyala (`entry_open`), jadi klien harus tahu sebelum menggambar tombol yang pasti gagal ditekan. */
  entryOpen: boolean
}

const ADS_OFF: Omit<AdsSessionState, 'now'> = {
  enabled: false,
  inAppEnabled: false,
  provider: null,
  unitId: null,
  viewsLeft: 0,
  cooldownSecondsLeft: 0,
  cooldownUntil: null,
  pass: null,
  entryOpen: false,
}

/** Premium mematikan interstitial otomatis saja (`inAppEnabled: false`). Tiket berhadiah sengaja tetap hidup untuk premium: ia tidak pernah muncul sendiri, hanya dirender sebagai tombol saat user butuh task tambahan, jadi tidak melanggar janji "bebas iklan yang ganggu" tapi tetap menjaga impresi yang membayari reward pool. */
export async function readAdsState(userId: number): Promise<AdsSessionState> {
  const resolved = resolveAdProvider()
  const enabled = Boolean(resolved) && adsConfigured()
  if (!resolved || !enabled) return { ...ADS_OFF, now: Date.now() }
  const premium = await isPremium(userId)
  const state = await readState(userId)
  return {
    enabled: true,
    /** Interstitial otomatis dimatikan di preview (`isPreviewShell()`, jadi suite tes tetap memakai perilaku produksi). Iframe preview tidak bisa dipakai Monetag — kreatifnya butuh jendela pihak ketiga — jadi yang tersisa hanya overlay hitam yang menutupi UI dan `show_<zone>()` yang reject terus. Tiket berhadiah (`enabled`) sengaja tetap hidup: itu opt-in dan jalur "Iklan"-nya masih perlu bisa diuji. Produksi tidak berubah. */
    inAppEnabled: !premium && !isPreviewShell(),
    provider: resolved.provider,
    unitId: resolved.unitId,
    viewsLeft: adViewsLeft(state.viewsToday),
    cooldownSecondsLeft: adCooldownSecondsLeft(state.lastOpenedAt, state.now),
    cooldownUntil: adCooldownUntil(state.lastOpenedAt),
    now: state.now,
    pass: state.hasReady && state.passExpiresAt !== null ? { expiresAt: state.passExpiresAt } : null,
    entryOpen: state.hasEntryOpen,
  }
}

export type OpenTicketResult =
  | {
      ok: true
      ticketId: string
      provider: AdProvider
      unitId: string
      expiresAt: number
    }
  | { ok: false; reason: AdRefusal; cooldownSecondsLeft: number; viewsLeft: number }

export async function openAdTicket(userId: number): Promise<OpenTicketResult> {
  const resolved = resolveAdProvider()
  if (!resolved)
    return { ok: false, reason: 'ads_disabled', cooldownSecondsLeft: 0, viewsLeft: 0 }
  const { provider, unitId } = resolved

  return transaction(async (tx) => {
    const state = await readState(userId, tx)
    const refusal = adOpenRefusal(state, state.now)
    if (refusal && refusal !== 'ticket_open')
      return {
        ok: false as const,
        reason: refusal,
        cooldownSecondsLeft: adCooldownSecondsLeft(state.lastOpenedAt, state.now),
        viewsLeft: adViewsLeft(state.viewsToday),
      }

    if (refusal === 'ticket_open') {
      const open = await tx.query<{ id: string; expires_at: Date }>(
        "select id, expires_at from ad_views where user_id=$1 and state='pending' limit 1",
        [userId],
      )
      const pending = open.rows[0]
      if (pending)
        return {
          ok: true as const,
          ticketId: pending.id,
          provider,
          unitId,
          expiresAt: pending.expires_at.getTime(),
        }
    }

    try {
      const inserted = await tx.query<{ id: string; expires_at: Date }>(
        `insert into ad_views(user_id,block_id,expires_at)
         values($1,$2,now()+($3::int * interval '1 second'))
         returning id, expires_at`,
        [userId, unitId, economyConfig().adsTicketTtlSeconds],
      )
      const row = inserted.rows[0]
      return {
        ok: true as const,
        ticketId: row.id,
        provider,
        unitId,
        expiresAt: row.expires_at.getTime(),
      }
    } catch (error) {
      if ((error as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw error
      return {
        ok: false as const,
        reason: 'ticket_open' as const,
        cooldownSecondsLeft: adCooldownSecondsLeft(state.lastOpenedAt, state.now),
        viewsLeft: adViewsLeft(state.viewsToday),
      }
    }
  })
}

export type ClaimTicketResult =
  | { ok: true; pass: { expiresAt: number } }
  | {
      ok: false
      reason:
        | 'no_ticket'
        | 'ticket_expired'
        | 'pass_ready'
        | 'awaiting_verification'
        | 'watch_too_short'
    }

const CLAIM_BURST_WINDOW_MINUTES = 10
const CLAIM_BURST_THRESHOLD = 5

/** Gerbang postback menyala: klien tidak lagi menerbitkan pass, ia hanya bertanya apakah Monetag sudah mengonfirmasi tayangannya. Yang menerbitkan `settleAdPostback`, jadi jalur ini murni baca. | Sinyal `ad_claim_too_fast` dan `ad_claim_burst` sengaja tidak dipasang di sini: keduanya mengukur kecurigaan pada klaim yang dipercaya, dan di mode ini klaim tidak memberi apa pun. Yang tersisa cuma `ad_claim_without_ticket`, karena menanyakan tiket yang tidak pernah ada tetap berarti ada yang mengarang ticketId. */
async function readVerifiedClaim(userId: number, ticketId: string): Promise<ClaimTicketResult> {
  const rows = await query<{ state: string; expires_at: Date; now: Date }>(
    'select state, expires_at, now() as now from ad_views where id=$1 and user_id=$2',
    [ticketId, userId],
  )
  const row = rows[0]
  if (!row) {
    await transaction((tx) =>
      recordAdClaimSignal(tx, userId, 'ad_claim_without_ticket', { ticketId, gated: true }),
    )
    return { ok: false, reason: 'no_ticket' }
  }
  if (row.state === 'ready') return { ok: true, pass: { expiresAt: row.expires_at.getTime() } }
  /** Baris yang sudah `consumed` atau `expired` bukan tiket karangan — ia tiket yang riwayatnya sudah lewat, jadi tidak menerbitkan sinyal fraud. */
  if (row.state !== 'pending') return { ok: false, reason: 'no_ticket' }
  if (row.expires_at.getTime() <= row.now.getTime())
    return { ok: false, reason: 'ticket_expired' }
  return { ok: false, reason: 'awaiting_verification' }
}

export async function claimAdTicket(userId: number, ticketId: string): Promise<ClaimTicketResult> {
  if (!ticketId || !isTicketId(ticketId)) {
    await transaction((tx) =>
      recordAdClaimSignal(tx, userId, 'ad_claim_without_ticket', { ticketId: null }),
    )
    return { ok: false, reason: 'no_ticket' }
  }

  if (adsPostbackRequired()) return readVerifiedClaim(userId, ticketId)

  return transaction(async (tx) => {
    const locked = await tx.query<{ state: string; created_at: Date; expires_at: Date; now: Date }>(
      'select state, created_at, expires_at, now() as now from ad_views where id=$1 and user_id=$2 for update',
      [ticketId, userId],
    )
    const row = locked.rows[0]
    if (!row) {
      await recordAdClaimSignal(tx, userId, 'ad_claim_without_ticket', { ticketId, state: null })
      return { ok: false as const, reason: 'no_ticket' as const }
    }
    /** Klasifikasinya dikembarkan dengan `readVerifiedClaim` di atas, dan itu bukan kerapian: sejak `settleAdPostback` bisa menerbitkan pass sendiri — dan ia jalan TANPA memeriksa `adsPostbackRequired` — baris 'ready' milik user ini berarti Monetag mengonfirmasi lebih dulu daripada klaim yang berangkat dari perangkatnya. Keduanya berangkat pada momen yang sama, jadi siapa yang menang murni balapan. Menjawabnya `no_ticket` membuat user membaca "tiket iklan tidak ketemu" tepat setelah menonton iklan penuh, sementara passnya justru sudah siap — dan menuliskan sinyal fraud atas orang yang tidak melakukan apa pun. Sinyal itu masuk `sum(f.severity)` yang jadi skor risiko di antrean payout, yaitu angka yang dibaca admin tepat sebelum mentransfer uang. */
    if (row.state === 'ready') {
      return { ok: true as const, pass: { expiresAt: row.expires_at.getTime() } }
    }
    /** Baris yang sudah `consumed` atau `expired` bukan tiket karangan — ia tiket yang riwayatnya sudah lewat, jadi tidak menerbitkan sinyal fraud. */
    if (row.state !== 'pending') return { ok: false as const, reason: 'no_ticket' as const }

    const now = row.now.getTime()
    if (row.expires_at.getTime() <= now) {
      await tx.query('update ad_views set state=$2 where id=$1', [ticketId, 'expired'])
      return { ok: false as const, reason: 'ticket_expired' as const }
    }
    /** Dari mencatat jadi MENOLAK. Sinyalnya tetap ditulis — pola berulang tetap perlu terbaca admin — tapi tiketnya tidak lagi terbit. Ini penjaga yang berdiri sendiri: ia tidak menanyakan apa pun ke penyedia iklan, jadi ia tetap berlaku saat gerbang postback masih mati DAN saat penyedia ternyata membayar klik yang langsung ditutup. Diukur dari `created_at` (jam Postgres saat tiket dibuka) sampai `now()`, jadi satu-satunya cara melewatinya adalah benar-benar menunggu. */
    if (adWatchTooShort(row.created_at.getTime(), now)) {
      await recordAdClaimSignal(tx, userId, 'ad_claim_too_fast', {
        ticketId,
        watchedMs: adWatchedMs(row.created_at.getTime(), now),
        minimumMs: adsMinWatchSeconds() * 1_000,
      })
      return { ok: false as const, reason: 'watch_too_short' as const }
    }

    const burst = await tx.query<{ recent: number }>(
      `select count(*)::int as recent from ad_views
        where user_id=$1 and ready_at > now() - ($2::int * interval '1 minute')`,
      [userId, CLAIM_BURST_WINDOW_MINUTES],
    )
    if (Number(burst.rows[0].recent) >= CLAIM_BURST_THRESHOLD) {
      await recordAdClaimSignal(tx, userId, 'ad_claim_burst', {
        klaim: Number(burst.rows[0].recent),
        windowMinutes: CLAIM_BURST_WINDOW_MINUTES,
      })
    }

    try {
      const claimed = await tx.query<{ expires_at: Date }>(
        `update ad_views
           set state='ready', ready_at=now(), expires_at=now()+($3::int * interval '1 minute')
         where id=$1 and user_id=$2 and state='pending'
         returning expires_at`,
        [ticketId, userId, economyConfig().adsPassTtlMinutes],
      )
      const updated = claimed.rows[0]
      if (!updated) return { ok: false as const, reason: 'no_ticket' as const }
      return { ok: true as const, pass: { expiresAt: updated.expires_at.getTime() } }
    } catch (error) {
      if ((error as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw error
      return { ok: false as const, reason: 'pass_ready' as const }
    }
  })
}

export async function consumeAdPass(
  tx: PoolClient,
  userId: number,
): Promise<{ id: string } | null> {
  const consumed = await tx.query<{ id: string }>(
    `update ad_views set state='consumed', consumed_at=now()
      where user_id=$1 and state='ready' and expires_at>now()
      returning id`,
    [userId],
  )
  return consumed.rows[0] ?? null
}

export async function restoreAdPass(
  tx: PoolClient,
  userId: number,
  adViewId: string,
): Promise<boolean> {
  /** Slot `ad_views_one_ready` bisa ditempati pass yang tenggatnya sudah lewat: sapuan `EXPIRE_STALE_SQL` hanya jalan di `readState` (`/api/session`, `/api/ads/ticket`), tidak di jalur pengembalian ini. Tanpa disapu lebih dulu, pass mati itu tetap memblokir `not exists` di bawah dan iklan yang benar-benar ditonton hangus permanen — persis kerugian yang penjagaan itu justru dibuat untuk dihindari. Disapu, bukan sekadar diabaikan di klausanya: indeks uniknya tidak menerima dua baris 'ready' sekaligus. */
  await tx.query(EXPIRE_STALE_SQL, [userId])
  const restored = await tx.query<{ id: string }>(
    `update ad_views
        set state='ready', consumed_at=null,
            expires_at=ready_at+($3::int * interval '1 minute')
      where id=$1 and user_id=$2 and state='consumed'
        and ready_at+($3::int * interval '1 minute') > now()
        and not exists (
          select 1 from ad_views other
           where other.user_id=$2 and other.state='ready'
        )
      returning id`,
    [adViewId, userId, economyConfig().adsPassTtlMinutes],
  )
  return restored.rowCount !== 0
}
