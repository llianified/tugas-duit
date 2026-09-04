import type { PoolClient } from 'pg'
import {
  ARCADE_OPEN_PLAY_TTL_MINUTES as OPEN_PLAY_TTL_MINUTES,
  arcadeAdGated,
  arcadeCooldownSecondsLeft,
  arcadeCooldownUntil,
  arcadeEnabled,
  arcadeMatchSeconds,
  arcadeOpenRefusal,
  arcadePlaysLeft,
  arcadePrizeTable,
  BLANK_PRIZE,
  BOX_COUNT,
  drawPrize,
  eligiblePrizes,
  MATCH_PAIRS,
  type ArcadeGame,
  type ArcadeHeadroom,
  type ArcadePrize,
  type ArcadePrizeEntry,
  type ArcadeRefusal,
} from '@/domain/arcade/arcade'
import { consumeAdPass, restoreAdPass } from '../ads/ads'
import { grantEnergy, readEnergy } from '../economy/energy'
import { readRewardPool, refillRewardPool } from '../economy/reward-pool'
import { transaction } from '../platform/db'

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"
const PG_UNIQUE_VIOLATION = '23505'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Main yang ditinggal dikembalikan pass iklannya, tidak dihanguskan. Iklannya sudah benar-benar ditonton, dan yang menahan penyalahgunaan bukan pass itu melainkan jatah harian — barisnya tetap terhitung di `plays_today` walau state-nya berubah jadi 'expired', jadi meninggalkan ronde berulang kali tetap menghabiskan jatah orang itu sendiri. `restoreAdPass` sendiri menolak kalau user sudah memegang pass lain yang siap, jadi stok pass tidak bisa ditumpuk lewat jalur ini. */
async function expireStalePlays(tx: PoolClient, userId: number): Promise<void> {
  const stale = await tx.query<{ id: string; ad_view_id: string | null }>(
    `select id, ad_view_id from arcade_plays
      where user_id=$1 and state='open'
        and opened_at <= now() - ($2::int * interval '1 minute')
      for update`,
    [userId, OPEN_PLAY_TTL_MINUTES],
  )
  for (const row of stale.rows) {
    await tx.query("update arcade_plays set state='expired' where id=$1 and state='open'", [row.id])
    if (row.ad_view_id !== null) await restoreAdPass(tx, userId, row.ad_view_id)
  }
}

type StateRow = {
  plays_today: number
  last_opened_at: Date | null
  open_id: string | null
  open_game: string | null
  open_at: Date | null
  ready_count: number
  now: Date
}

/** Jatah harian dihitung dari main yang DIBUKA, bukan yang disetel. Ongkosnya sudah dibayar di pembukaan — satu pass iklan hangus di situ — jadi menghitung yang disetel saja akan membuat ronde yang ditinggal menjadi gratis, dan itu jalan termurah untuk menguras jatah tanpa pernah menghabiskannya. */
const STATE_SQL = `select
    (select count(*) from arcade_plays
      where user_id=$1 and quota_date = ${TODAY})::int as plays_today,
    (select max(opened_at) from arcade_plays where user_id=$1) as last_opened_at,
    (select id from arcade_plays where user_id=$1 and state='open' limit 1) as open_id,
    (select game from arcade_plays where user_id=$1 and state='open' limit 1) as open_game,
    (select opened_at from arcade_plays where user_id=$1 and state='open' limit 1) as open_at,
    (select count(*) from ad_views
      where user_id=$1 and state='ready' and expires_at > now())::int as ready_count,
    now() as now`

async function readRow(tx: PoolClient, userId: number): Promise<StateRow> {
  const result = await tx.query<StateRow>(STATE_SQL, [userId])
  return result.rows[0]
}

async function readHeadroom(userId: number, tx?: PoolClient): Promise<ArcadeHeadroom> {
  const [pool, energy] = await Promise.all([readRewardPool(userId, tx), readEnergy(userId, tx)])
  return {
    pool: Math.max(0, pool.max - pool.current),
    energy: Math.max(0, energy.max - energy.current),
  }
}

export interface ArcadeOpenPlay {
  id: string
  game: ArcadeGame
  /** Tenggat penyetelan. Lewat dari ini ronde dianggap ditinggal dan slotnya dibebaskan. */
  expiresAt: number
}

export interface ArcadeState {
  enabled: boolean
  adGated: boolean
  playsLeft: number
  cooldownSecondsLeft: number
  /** Tenggat cooldown sebagai timestamp, bukan cuma sisa detiknya: `cooldownSecondsLeft` langsung basi begitu terkirim, jadi klien butuh titik akhirnya untuk memajukan hitung mundurnya sendiri. Pola yang sama dipakai `energy.nextAt`, `rewardPool.nextAt`, dan `ads.cooldownUntil`. */
  cooldownUntil: number | null
  hasAdPass: boolean
  matchSeconds: number
  boxCount: number
  matchPairs: number
  /** Seluruh tabel hadiah apa adanya, termasuk yang bobotnya nol, supaya layar bantuan bisa jujur soal peluang. */
  prizes: ArcadePrizeEntry[]
  /** Hadiah yang benar-benar bisa jatuh untuk user ini sekarang, sesudah sisa kapasitas stok dan energinya diperhitungkan. */
  winnable: ArcadePrizeEntry[]
  openPlay: ArcadeOpenPlay | null
  refusal: ArcadeRefusal | null
  now: number
}

const ARCADE_OFF: Omit<ArcadeState, 'now'> = {
  enabled: false,
  adGated: false,
  playsLeft: 0,
  cooldownSecondsLeft: 0,
  cooldownUntil: null,
  hasAdPass: false,
  matchSeconds: 0,
  boxCount: BOX_COUNT,
  matchPairs: MATCH_PAIRS,
  prizes: [],
  winnable: [],
  openPlay: null,
  refusal: 'arcade_disabled',
}

export async function readArcadeState(userId: number): Promise<ArcadeState> {
  if (!arcadeEnabled()) return { ...ARCADE_OFF, now: Date.now() }

  return transaction(async (tx) => {
    await expireStalePlays(tx, userId)
    const row = await readRow(tx, userId)
    const headroom = await readHeadroom(userId, tx)
    const now = row.now.getTime()
    const lastOpenedAt = row.last_opened_at ? row.last_opened_at.getTime() : null
    const hasAdPass = Number(row.ready_count) > 0
    const openPlay: ArcadeOpenPlay | null =
      row.open_id && row.open_game && row.open_at
        ? {
            id: row.open_id,
            game: row.open_game as ArcadeGame,
            expiresAt: row.open_at.getTime() + OPEN_PLAY_TTL_MINUTES * 60_000,
          }
        : null

    return {
      enabled: true,
      adGated: arcadeAdGated(),
      playsLeft: arcadePlaysLeft(Number(row.plays_today)),
      cooldownSecondsLeft: arcadeCooldownSecondsLeft(lastOpenedAt, now),
      cooldownUntil: arcadeCooldownUntil(lastOpenedAt),
      hasAdPass,
      matchSeconds: arcadeMatchSeconds(),
      boxCount: BOX_COUNT,
      matchPairs: MATCH_PAIRS,
      prizes: arcadePrizeTable(),
      winnable: eligiblePrizes(headroom),
      openPlay,
      refusal: arcadeOpenRefusal(
        {
          playsToday: Number(row.plays_today),
          lastOpenedAt,
          hasOpenPlay: openPlay !== null,
          hasAdPass,
          headroom,
        },
        now,
      ),
      now,
    }
  })
}

export type OpenPlayResult =
  | { ok: true; play: ArcadeOpenPlay; matchSeconds: number }
  | { ok: false; reason: ArcadeRefusal }

/** Ongkos masuk dibayar di sini, hasilnya digulirkan di `settleArcadePlay`. Dipecah dua karena ronde Cocokkan Kartu berjalan di klien: kalau pass iklan baru dipotong saat menyetel, ronde yang kalah menjadi gratis dan satu tayangan iklan bisa dipakai mencoba berkali-kali sampai menang. Pemisahan yang sama dipakai tiket iklan terhadap `startChallenge`. */
export async function openArcadePlay(userId: number, game: ArcadeGame): Promise<OpenPlayResult> {
  if (!arcadeEnabled()) return { ok: false, reason: 'arcade_disabled' }

  return transaction(async (tx) => {
    await expireStalePlays(tx, userId)
    const row = await readRow(tx, userId)
    const headroom = await readHeadroom(userId, tx)
    const now = row.now.getTime()

    const refusal = arcadeOpenRefusal(
      {
        playsToday: Number(row.plays_today),
        lastOpenedAt: row.last_opened_at ? row.last_opened_at.getTime() : null,
        hasOpenPlay: row.open_id !== null,
        hasAdPass: Number(row.ready_count) > 0,
        headroom,
      },
      now,
    )
    if (refusal) return { ok: false as const, reason: refusal }

    /** Pass dipotong sebelum barisnya ditulis, dan kalau penulisan barisnya kalah balapan di `arcade_plays_one_open` seluruh transaksi dibatalkan — jadi pass yang terpotong ikut kembali. Itu alasan dua langkah ini wajib satu transaksi. */
    let adViewId: string | null = null
    if (arcadeAdGated()) {
      const pass = await consumeAdPass(tx, userId)
      if (!pass) return { ok: false as const, reason: 'no_ad_pass' as const }
      adViewId = pass.id
    }

    try {
      const inserted = await tx.query<{ id: string; opened_at: Date }>(
        `insert into arcade_plays(user_id, quota_date, game, ad_view_id)
         values($1, ${TODAY}, $2, $3)
         returning id, opened_at`,
        [userId, game, adViewId],
      )
      const play = inserted.rows[0]
      return {
        ok: true as const,
        play: {
          id: play.id,
          game,
          expiresAt: play.opened_at.getTime() + OPEN_PLAY_TTL_MINUTES * 60_000,
        },
        matchSeconds: arcadeMatchSeconds(),
      }
    } catch (error) {
      if ((error as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw error
      /** Dua indeks unik berbeda bisa menolak sisipan ini, dan obatnya berlawanan: `arcade_plays_one_open` berarti "selesaikan ronde yang ada", sementara `arcade_plays_ad_view_unique` berarti passnya sudah membayar ronde lain. Memetakan keduanya jadi satu pesan menyuruh user menutup ronde yang tidak ada. */
      const constraint = (error as { constraint?: string }).constraint
      return {
        ok: false as const,
        reason: constraint === 'arcade_plays_ad_view_unique' ? 'no_ad_pass' : 'play_open',
      }
    }
  })
}

export type SettleRefusal = 'unknown_play' | 'play_expired' | 'bad_pick'

export interface SettleInput {
  playId: string
  /** Kotak yang dipilih, hanya untuk permainan kotak. */
  pick?: number
  /** Hasil ronde Cocokkan Kartu menurut klien. Sengaja dipercaya apa adanya — alasannya di komentar `settleArcadePlay`. */
  won?: boolean
}

export interface SettleSuccess {
  ok: true
  prize: ArcadePrize
  /** Isi ketiga kotak, supaya layar bisa membuka yang tidak dipilih. Hanya untuk permainan kotak. */
  boxes: ArcadePrize[] | null
  energy: number | null
  energyMax: number | null
  poolCurrent: number | null
  poolMax: number | null
}

export type SettleResult = SettleSuccess | { ok: false; reason: SettleRefusal }

/** Hasil ronde Cocokkan Kartu datang dari klien dan tidak diverifikasi. Itu keputusan sadar, bukan kelalaian, dan alasannya persis sama dengan klaim iklan di `docs/keputusan-desain.md`: yang menahan penyalahgunaan bukan bukti bahwa rondenya betul dimainkan, melainkan jatah main harian, cooldown, dan pass iklan yang sudah terbakar di pembukaan. User yang selalu mengaku menang paling banter mendapat hadiah sebanyak jatah hariannya — angka yang sudah disetujui di panel dan sudah dibayar lunas oleh impresi iklannya. Memverifikasi papan berarti menyimpan susunan kartu dan seluruh urutan langkah di server demi menutup celah yang plafonnya sudah tutup. | Undian hadiahnya sendiri TIDAK dipercayakan ke klien: ia digulirkan di sini, sesudah sisa kapasitas dibaca ulang di dalam transaksi yang sama. */
export async function settleArcadePlay(userId: number, input: SettleInput): Promise<SettleResult> {
  if (!UUID_PATTERN.test(input.playId)) return { ok: false, reason: 'unknown_play' }

  return transaction(async (tx) => {
    const locked = await tx.query<{
      id: string
      game: string
      state: string
      opened_at: Date
      ad_view_id: string | null
      now: Date
    }>(
      `select id, game, state, opened_at, ad_view_id, now() as now from arcade_plays
        where id=$1 and user_id=$2 for update`,
      [input.playId, userId],
    )
    const row = locked.rows[0]
    if (!row || row.state !== 'open') return { ok: false as const, reason: 'unknown_play' as const }

    const now = row.now.getTime()
    /** Passnya dikembalikan di sini juga, persis seperti `expireStalePlays`. Ronde yang lewat TTL bisa ditutup dari dua arah — sapuan saat Arena dibuka lagi, atau penyetelan yang datang terlambat dari app yang sempat di-background — dan begitu barisnya keluar dari state 'open' sapuan tidak akan pernah bisa menyusul. Tanpa baris ini jalur kedua menghanguskan iklan yang sudah benar-benar ditonton, permanen. */
    if (now - row.opened_at.getTime() > OPEN_PLAY_TTL_MINUTES * 60_000) {
      await tx.query("update arcade_plays set state='expired' where id=$1", [row.id])
      if (row.ad_view_id !== null) await restoreAdPass(tx, userId, row.ad_view_id)
      return { ok: false as const, reason: 'play_expired' as const }
    }

    const game = row.game as ArcadeGame
    let pick: number | null = null
    if (game === 'boxes') {
      if (!Number.isInteger(input.pick) || (input.pick as number) < 0 || (input.pick as number) >= BOX_COUNT) {
        return { ok: false as const, reason: 'bad_pick' as const }
      }
      pick = input.pick as number
    }

    /** Sisa kapasitas dibaca ulang DI DALAM transaksi ini, bukan dibawa dari pembukaan. Stok dan energi terus mengisi sendiri selama ronde berjalan, jadi potret dari beberapa menit lalu bisa membuat hadiah yang sudah tidak muat lagi tetap terpilih lalu dijepit diam-diam. */
    const headroom = await readHeadroom(userId, tx)
    const entries = eligiblePrizes(headroom)

    const boxes = game === 'boxes' ? drawBoxes(entries) : null
    let prize: ArcadePrize
    if (boxes) {
      prize = boxes[pick as number]
    } else {
      // Ronde yang kalah tidak menggulirkan undian sama sekali: kalah berarti zonk, dan zonk
      // bukan salah satu hadiah yang sedang diundi.
      prize = input.won === true ? drawPrize(entries, Math.random()) : BLANK_PRIZE
    }

    await tx.query(
      `update arcade_plays
         set state='settled', settled_at=now(), pick=$2, prize_kind=$3, prize_amount=$4
       where id=$1 and state='open'`,
      [row.id, pick, prize.kind, prize.amount],
    )

    let energyState: { current: number; max: number } | null = null
    let poolState: { current: number; max: number } | null = null

    if (prize.kind === 'energy' && prize.amount > 0) {
      const granted = await grantEnergy(tx, userId, prize.amount)
      energyState = { current: granted.state.current, max: granted.state.max }
    }
    if (prize.kind === 'pool' && prize.amount > 0) {
      const refilled = await refillRewardPool(tx, userId, prize.amount)
      poolState = { current: refilled.after, max: refilled.capacity }
    }

    return {
      ok: true as const,
      prize,
      boxes,
      energy: energyState?.current ?? null,
      energyMax: energyState?.max ?? null,
      poolCurrent: poolState?.current ?? null,
      poolMax: poolState?.max ?? null,
    }
  })
}

/** Tiga kotak, tiga undian terpisah. Pilihan user menentukan kotak MANA yang jadi miliknya, bukan besar hadiahnya — jadi layar boleh membuka dua kotak sisanya tanpa berbohong soal apa yang ada di dalamnya. */
function drawBoxes(entries: readonly ArcadePrizeEntry[]): ArcadePrize[] {
  return Array.from({ length: BOX_COUNT }, () => drawPrize(entries, Math.random()))
}
