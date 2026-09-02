import { creditsToRupiah, withdrawalMinimumCredits } from '../domain/economy.ts'
import { validateEconomyConfig, setActiveEconomyConfig } from '../domain/economy-config.ts'
import { maxEnergy, projectEnergy } from '../domain/energy.ts'
import { isPremiumActive, withdrawalCooldownMs } from '../domain/premium.ts'
import { projectRewardPool, rewardPoolCapacity } from '../domain/reward-pool.ts'
import { getRank } from '../domain/progression.ts'
import { formatCredits, formatRupiah } from '../shared/lib/format.ts'
import { query } from './db.ts'
import { requiredActiveDays, requiredActiveReferrals } from './payout-rules.ts'
import { escapeTelegramHtml as escapeHtml, openAppMarkup, sendTelegramMessage } from './telegram.ts'

export type EngagementKind =
  | 'withdraw_ready'
  | 'rank_up'
  | 'streak_risk'
  | 'commission_digest'
  | 'referral_joined'
  | 'winback_7'
  | 'winback_3'
  | 'pool_full'
  | 'energy_full'

const HOUR_FIRST = 8
const HOUR_LAST = 20
const STREAK_REMINDER_HOURS = [19, 20]

/** Diekspor supaya jadwal cron bisa diuji terhadapnya. Jalan pemeliharaan yang jatuh di luar rentang ini menyelesaikan pembersihan dengan normal tapi tidak mengirim satu pesan pun — kegagalan yang tidak memunculkan error di mana pun. */
export const ENGAGEMENT_HOURS = {
  first: HOUR_FIRST,
  last: HOUR_LAST,
  streakReminder: STREAK_REMINDER_HOURS,
} as const
const ENERGY_IDLE_HOURS = 3
const POOL_IDLE_HOURS = 6
const STREAK_LOOKBACK_DAYS = 120
const MAX_SENDS_PER_RUN = 500
const SEND_GAP_MS = 60

/** Anggaran waktu, bukan sekadar plafon jumlah. `MAX_SENDS_PER_RUN` sendirian tidak pernah bisa menghentikan putaran tepat waktu: 500 kirim x `SEND_GAP_MS` sudah 30 detik sebelum satu pun round-trip Telegram dihitung, sementara route cron-nya dibatasi `maxDuration = 60`. Yang terjadi bukan "sisanya jam depan" melainkan proses dibunuh di tengah — dan karena `deliver()` menulis penanda `bot_notifications` SEBELUM mengirim, user yang penandanya sempat tertulis tapi pesannya belum terkirim tidak akan pernah dicoba lagi. Jadi putaran berhenti sendiri sebelum tenggatnya, dengan sisa yang cukup untuk merapikan dan mengembalikan ringkasan. Penanda hanya ditulis untuk pesan yang benar-benar sempat dikirim. */
export const DEFAULT_SEND_BUDGET_MS = 30_000

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"

const CANDIDATE_SQL = `select
    u.id,
    u.telegram_id,
    u.balance_credits,
    u.energy,
    u.energy_updated_at,
    u.reward_pool,
    u.reward_pool_updated_at,
    u.premium_until,
    (select count(*) from task_completions tc where tc.user_id=u.id)::int completed_count,
    (select count(*) from task_completions tc
      where tc.user_id=u.id and tc.completed_at <= now() - interval '24 hours')::int
      completed_count_before,
    (select max(completed_at) from task_completions tc where tc.user_id=u.id) last_task_at,
    (select count(*) from task_completions tc
      where tc.user_id=u.id and (tc.completed_at at time zone 'Asia/Jakarta')::date = ${TODAY})::int
      tasks_today,
    (select count(distinct rc.downline_id) from referral_commissions rc where rc.upline_id=u.id)::int
      active_referrals,
    (select count(distinct (tc.completed_at at time zone 'Asia/Jakarta')::date)
       from task_completions tc where tc.user_id=u.id)::int active_days,
    (select max(w.requested_at) from withdrawals w where w.user_id=u.id) last_withdrawal_at,
    (select count(*) from withdrawals w where w.user_id=u.id and w.state='processing')::int
      processing_withdrawals,
    coalesce((select dq.commission_credits from daily_quotas dq
       where dq.user_id=u.id and dq.quota_date=${TODAY}), 0)::int commission_today,
    (select count(*) from users d
      where d.referred_by=u.id and (d.created_at at time zone 'Asia/Jakarta')::date = ${TODAY})::int
      new_referrals_today,
    now() as now
  from users u
  where u.banned_at is null
    and u.notifications_muted_at is null
    and exists (select 1 from task_completions tc where tc.user_id=u.id)`

/** Rentetan hari aktif yang berakhir **kemarin**, bukan yang berakhir hari ini: pesannya justru untuk user yang belum menyentuh task hari ini, jadi hari ini tidak boleh ikut dihitung. Bentuk kolomnya sengaja sama dengan `STREAK_EXPRESSION` di `streak-sql.ts` — batas hari WIB, baris pertama yang tidak jatuh tepat `rn - 1` hari sebelum acuan adalah tempat putusnya. */
const STREAK_SQL = `with active as (
    select user_id, (completed_at at time zone 'Asia/Jakarta')::date as day
      from task_completions
     where completed_at > now() - ($1::int * interval '1 day')
     group by 1, 2
  ), ordered as (
    select user_id, day, (row_number() over (partition by user_id order by day desc))::int rn
      from active
  ), yesterday as (
    select ${TODAY} - 1 as day
  )
  select user_id,
         coalesce(
           min(rn) filter (where day <> (select day from yesterday) - (rn - 1)) - 1,
           count(*)
         )::int streak
    from ordered
   group by user_id`

export type CandidateRow = {
  id: string
  telegram_id: string
  balance_credits: string
  energy: number
  energy_updated_at: Date
  reward_pool: number
  reward_pool_updated_at: Date
  premium_until: Date | null
  completed_count: number
  completed_count_before: number
  last_task_at: Date | null
  tasks_today: number
  active_referrals: number
  active_days: number
  last_withdrawal_at: Date | null
  processing_withdrawals: number
  commission_today: number
  new_referrals_today: number
  now: Date
}

export interface Message {
  kind: EngagementKind
  dedupeKey: string
  text: string
  buttonLabel: string
}

const money = (credits: number) =>
  `${formatCredits(credits)} credit (${formatRupiah(creditsToRupiah(credits))})`

const wibDayKey = (at: Date) => at.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

const wibHour = (at: Date) =>
  Number(
    at.toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }),
  ) % 24

const hoursSince = (at: Date | null, now: Date) =>
  at === null ? Number.POSITIVE_INFINITY : (now.getTime() - at.getTime()) / 3_600_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadConfig(): Promise<boolean> {
  const rows = await query<{ config: unknown }>('select config from economy_config where id=1')
  const parsed = validateEconomyConfig(rows[0]?.config)
  if (!parsed.ok) {
    console.error('[engagement] economy_config tidak lolos validasi, pengiriman dibatalkan:', parsed.errors)
    return false
  }
  setActiveEconomyConfig(parsed.config)
  return true
}

function withdrawReady(row: CandidateRow, balance: number, premium: boolean): boolean {
  if (balance < withdrawalMinimumCredits()) return false
  if (row.processing_withdrawals > 0) return false
  if (row.active_referrals < requiredActiveReferrals()) return false
  if (row.active_days < requiredActiveDays()) return false
  if (!row.last_withdrawal_at) return true
  return row.last_withdrawal_at.getTime() + withdrawalCooldownMs(premium) <= row.now.getTime()
}

export function pickMessage(row: CandidateRow, streak: number): Message | null {
  const now = row.now
  const today = wibDayKey(now)
  const hour = wibHour(now)
  const balance = Number(row.balance_credits)
  const idleHours = hoursSince(row.last_task_at, now)
  const rank = getRank(row.completed_count)
  const premium = isPremiumActive(
    row.premium_until ? row.premium_until.getTime() : null,
    now.getTime(),
  )

  const energy = projectEnergy(
    { energy: Number(row.energy), updatedAt: row.energy_updated_at.getTime() },
    now.getTime(),
    premium,
  )
  const pool = projectRewardPool(
    { credits: Number(row.reward_pool), updatedAt: row.reward_pool_updated_at.getTime() },
    rewardPoolCapacity({ rankTier: rank.tier, streak, premium }),
    now.getTime(),
  )

  if (withdrawReady(row, balance, premium)) {
    return {
      kind: 'withdraw_ready',
      dedupeKey: today,
      buttonLabel: '💸 Ajukan penarikan',
      text: [
        '<b>Saldo kamu udah bisa dicairkan 💸</b>',
        '',
        `Sekarang ada ${money(balance)} di akun kamu, dan syaratnya udah kelar semua. Tinggal ajukan.`,
        '',
        `Catatan: sekali diajukan, penarikan berikutnya baru kebuka ${formatCredits(Math.round(withdrawalCooldownMs(premium) / 86_400_000))} hari lagi — jadi pikirin dulu mau narik berapa.`,
      ].join('\n'),
    }
  }

  if (rank.tier > getRank(row.completed_count_before).tier) {
    return {
      kind: 'rank_up',
      dedupeKey: String(rank.tier),
      buttonLabel: '🎮 Buka app',
      text: [
        `<b>Rank kamu naik jadi ${escapeHtml(rank.name)} 🏅</b>`,
        '',
        `${formatCredits(row.completed_count)} task kelar. Daya tampung stok reward kamu ikut naik, jadi sekali duduk bisa ngumpulin lebih banyak sebelum stoknya habis.`,
      ].join('\n'),
    }
  }

  if (row.tasks_today === 0 && streak >= 2 && STREAK_REMINDER_HOURS.includes(hour)) {
    return {
      kind: 'streak_risk',
      dedupeKey: today,
      buttonLabel: '🔥 Selamatin streak',
      text: [
        `<b>Streak ${formatCredits(streak)} hari kamu hampir putus 🔥</b>`,
        '',
        'Hari ini belum ada task yang kelar. Satu aja udah cukup buat nyambungin streak-nya sebelum ganti hari.',
        '',
        'Streak panjang bikin daya tampung stok reward kamu makin gede.',
      ].join('\n'),
    }
  }

  if (row.commission_today > 0) {
    return {
      kind: 'commission_digest',
      dedupeKey: today,
      buttonLabel: '💰 Cek saldo',
      text: [
        '<b>Komisi dari teman kamu masuk 🎉</b>',
        '',
        `Hari ini kamu dapat ${money(row.commission_today)} dari task yang dikerjain teman-teman kamu. Tanpa ngapa-ngapain.`,
      ].join('\n'),
    }
  }

  if (row.new_referrals_today > 0) {
    return {
      kind: 'referral_joined',
      dedupeKey: today,
      buttonLabel: '👥 Lihat referral',
      text: [
        `<b>${formatCredits(row.new_referrals_today)} teman baru pakai kode kamu 👋</b>`,
        '',
        'Begitu mereka mulai ngerjain task, komisinya ngalir ke kamu otomatis. Sekalian colek mereka biar cepet mulai ya.',
      ].join('\n'),
    }
  }

  if (idleHours >= 24 * 7) {
    return {
      kind: 'winback_7',
      dedupeKey: wibDayKey(row.last_task_at ?? now),
      buttonLabel: '👋 Balik ngumpulin',
      text: [
        '<b>Kangen, udah seminggu nih 👋</b>',
        '',
        `Saldo kamu masih aman ${money(balance)}, energi udah penuh dari kemarin-kemarin.`,
        '',
        'Balik bentar aja, beberapa soal udah nambah saldo lagi.',
      ].join('\n'),
    }
  }

  if (idleHours >= 24 * 3) {
    return {
      kind: 'winback_3',
      dedupeKey: wibDayKey(row.last_task_at ?? now),
      buttonLabel: '👀 Intip app',
      text: [
        '<b>Udah 3 hari nggak mampir 👀</b>',
        '',
        `Energi kamu ${formatCredits(energy.current)}/${formatCredits(energy.max)} dan stok reward-nya nunggu dipakai.`,
        '',
        'Lumayan buat nambah saldo sambil rebahan.',
      ].join('\n'),
    }
  }

  if (pool.nextAt === null && idleHours >= POOL_IDLE_HOURS) {
    return {
      kind: 'pool_full',
      dedupeKey: today,
      buttonLabel: '💰 Ambil sekarang',
      text: [
        '<b>Stok reward kamu penuh 💰</b>',
        '',
        `Ada ${money(pool.current)} yang siap kamu ambil sekarang.`,
        '',
        'Selama masih penuh, stoknya berhenti nambah — jadi sayang kalau didiemin.',
      ].join('\n'),
    }
  }

  if (energy.current >= maxEnergy(premium) && idleHours >= ENERGY_IDLE_HOURS) {
    return {
      kind: 'energy_full',
      dedupeKey: today,
      buttonLabel: '⚡ Pakai energinya',
      text: [
        '<b>Energi kamu penuh lagi ⚡</b>',
        '',
        `${formatCredits(energy.current)}/${formatCredits(energy.max)} energi siap dipakai. Energi yang udah penuh berhenti ngisi, jadi mending langsung dihabisin.`,
        '',
        'Pecahin soal, credit-nya masuk.',
      ].join('\n'),
    }
  }

  return null
}

/** Penanda ditulis dulu, baru pesannya dikirim: `bot_notifications_once` yang memastikan satu pesan tidak berangkat dua kali, dan itu hanya berlaku kalau barisnya sudah commit sebelum panggilan ke Telegram. Kirim yang gagal menghapus penandanya lagi supaya cron berikutnya boleh mencoba ulang — lebih baik telat sejam daripada hilang diam-diam. */
async function deliver(row: CandidateRow, message: Message): Promise<boolean> {
  const claimed = await query<{ id: string }>(
    `insert into bot_notifications(user_id, kind, dedupe_key) values($1,$2,$3)
     on conflict do nothing returning id`,
    [Number(row.id), message.kind, message.dedupeKey],
  )
  if (claimed.length === 0) return false

  try {
    await sendTelegramMessage(row.telegram_id, message.text, openAppMarkup(message.buttonLabel))
    return true
  } catch (error) {
    await query('delete from bot_notifications where id=$1', [Number(claimed[0].id)])
    throw error
  }
}

export async function runEngagementNotifications(
  options: { now?: Date; budgetMs?: number } = {},
): Promise<Record<string, number>> {
  if (!(await loadConfig())) return {}

  const budgetMs = options.budgetMs ?? DEFAULT_SEND_BUDGET_MS
  const deadline = Date.now() + budgetMs

  const clock = options.now ?? (await query<{ now: Date }>('select now() as now'))[0]?.now
  const hour = wibHour(clock ?? new Date())
  if (hour < HOUR_FIRST || hour > HOUR_LAST) {
    console.log(`[engagement] pukul ${hour} WIB di luar jam kirim, dilewati`)
    return {}
  }

  const [candidates, streaks] = await Promise.all([
    query<CandidateRow>(CANDIDATE_SQL),
    query<{ user_id: string; streak: number }>(STREAK_SQL, [STREAK_LOOKBACK_DAYS]),
  ])
  const streakOf = new Map(streaks.map((row) => [String(row.user_id), Number(row.streak)]))

  const sent: Record<string, number> = {}
  let total = 0
  for (const row of candidates) {
    if (total >= MAX_SENDS_PER_RUN) {
      console.warn(`[engagement] batas ${MAX_SENDS_PER_RUN} pesan per putaran tercapai, sisanya putaran berikutnya`)
      break
    }
    if (Date.now() >= deadline) {
      console.warn(
        `[engagement] anggaran ${budgetMs}ms habis setelah ${total} pesan, sisanya putaran berikutnya`,
      )
      break
    }
    const message = pickMessage(row, streakOf.get(String(row.id)) ?? 0)
    if (!message) continue

    try {
      if (!(await deliver(row, message))) continue
      sent[message.kind] = (sent[message.kind] ?? 0) + 1
      total += 1
      await sleep(SEND_GAP_MS)
    } catch (error) {
      console.error(`[engagement] ${message.kind} gagal dikirim ke ${row.telegram_id}:`, error)
    }
  }
  return sent
}
