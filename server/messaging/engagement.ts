import { creditsToRupiah, withdrawalMinimumCredits } from '../../domain/economy/economy.ts'
import { starReward, validateEconomyConfig, setActiveEconomyConfig } from '../../domain/economy/economy-config.ts'
import { maxEnergy, projectEnergy } from '../../domain/economy/energy.ts'
import { isPremiumActive, withdrawalCooldownMs } from '../../domain/economy/premium.ts'
import { projectRewardPool, rewardPoolCapacity } from '../../domain/economy/reward-pool.ts'
import { SEASON_ANCHOR, leaderboardSeasonDays } from '../../domain/progression/leaderboard.ts'
import { isMissionAvailable, missionDefinition } from '../../domain/progression/missions.ts'
import { getRank } from '../../domain/progression/progression.ts'
import { storeCatalog, storeEnabled } from '../../domain/store/store.ts'
import { formatCredits, formatRupiah } from '../../shared/lib/format.ts'
import { query } from '../platform/db.ts'
import { payoutRequiresPremium, requiredActiveReferrals } from '../payout/payout-rules.ts'
import { escapeTelegramHtml as escapeHtml, openAppMarkup, sendTelegramMessage } from '../integrations/telegram.ts'

export type EngagementKind =
  | 'withdraw_ready'
  | 'rank_up'
  | 'streak_risk'
  | 'mission_ready'
  | 'commission_digest'
  | 'referral_joined'
  | 'season_ending'
  | 'winback_7'
  | 'winback_3'
  | 'pool_full'
  | 'store_idle'
  | 'energy_full'
  | 'daily_invite'

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

/** Sisa misi harian yang masih pantas jadi ajakan. Lebih dari ini kalimatnya berhenti terbaca
 * seperti "tinggal dikit lagi" dan mulai terbaca seperti daftar pekerjaan. */
const MISSION_NUDGE_LEFT = 2
const STREAK_LOOKBACK_DAYS = 120
const MAX_SENDS_PER_RUN = 500
const SEND_GAP_MS = 60

/** Anggaran waktu, bukan sekadar plafon jumlah. `MAX_SENDS_PER_RUN` sendirian tidak pernah bisa menghentikan putaran tepat waktu: 500 kirim x `SEND_GAP_MS` sudah 30 detik sebelum satu pun round-trip Telegram dihitung, sementara route cron-nya dibatasi `maxDuration = 60`. Yang terjadi bukan "sisanya jam depan" melainkan proses dibunuh di tengah — dan karena `deliver()` menulis penanda `bot_notifications` SEBELUM mengirim, user yang penandanya sempat tertulis tapi pesannya belum terkirim tidak akan pernah dicoba lagi. Jadi putaran berhenti sendiri sebelum tenggatnya, dengan sisa yang cukup untuk merapikan dan mengembalikan ringkasan. Penanda hanya ditulis untuk pesan yang benar-benar sempat dikirim. */
export const DEFAULT_SEND_BUDGET_MS = 30_000

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"

/** Berapa kandidat yang boleh dibaca satu putaran. Lebih besar dari `MAX_SENDS_PER_RUN` karena sebagian besar kandidat tidak punya pesan apa pun untuk hari itu — `pickMessage` mengembalikan `null` dan mereka dilewati tanpa memakai jatah kirim. Dua kali lipat memberi ruang itu tanpa mengembalikan biayanya ke seluruh basis user. */
const CANDIDATE_LIMIT = MAX_SENDS_PER_RUN * 2

/** Kandidat dipilih dulu, baru datanya dihitung. Bentuk lamanya menjalankan sebelas subquery berkorelasi untuk SETIAP user yang pernah menyelesaikan satu task, tanpa `limit`, di dalam lambda ber-`maxDuration = 60` — dan begitu kueri itu melewati satu menit, prosesnya dibunuh sebelum satu pesan pun terkirim, sementara `runMaintenance` tetap melaporkan sukses. Sekarang `picked` menyaring dan memotongnya lebih dulu dengan kolom yang murah, dan sebelas subquery itu hanya dibayar untuk baris yang benar-benar terpakai.
 *
 * Urutannya juga bukan lagi urutan pemindaian Postgres. Yang paling lama tidak dikirimi pesan didahulukan, dan di dalam kelompok yang belum pernah dikirimi sama sekali urutannya diacak — tanpa pengacakan itu himpunan 500 pertama adalah himpunan yang sama setiap hari, jadi user yang kebetulan di luar sana tidak pernah menerima "saldo kamu sudah bisa dicairkan" seumur hidupnya. */
const CANDIDATE_SQL = `with notified as (
    select user_id, max(sent_at) as at from bot_notifications group by user_id
  ), picked as (
    select u.id,
           u.telegram_id,
           u.balance_credits,
           u.energy,
           u.energy_updated_at,
           u.reward_pool,
           u.reward_pool_updated_at,
           u.premium_until
      from users u
      left join notified n on n.user_id = u.id
     where u.banned_at is null
       and u.notifications_muted_at is null
       and exists (select 1 from task_completions tc where tc.user_id=u.id)
     order by coalesce(n.at, 'epoch'::timestamptz) asc, random()
     limit $1
  )
  select
    p.id,
    p.telegram_id,
    p.balance_credits,
    p.energy,
    p.energy_updated_at,
    p.reward_pool,
    p.reward_pool_updated_at,
    p.premium_until,
    (select count(*) from task_completions tc where tc.user_id=p.id)::int completed_count,
    (select count(*) from task_completions tc
      where tc.user_id=p.id and tc.completed_at <= now() - interval '24 hours')::int
      completed_count_before,
    (select max(completed_at) from task_completions tc where tc.user_id=p.id) last_task_at,
    (select count(*) from task_completions tc
      where tc.user_id=p.id and (tc.completed_at at time zone 'Asia/Jakarta')::date = ${TODAY})::int
      tasks_today,
    (select count(*) from task_completions tc
      where tc.user_id=p.id and tc.completed_at > now() - interval '7 days')::int tasks_recent,
    (select count(distinct rc.downline_id) from referral_commissions rc where rc.upline_id=p.id)::int
      active_referrals,
    (select max(w.requested_at) from withdrawals w where w.user_id=p.id) last_withdrawal_at,
    (select count(*) from withdrawals w where w.user_id=p.id and w.state='processing')::int
      processing_withdrawals,
    coalesce((select dq.commission_credits from daily_quotas dq
       where dq.user_id=p.id and dq.quota_date=${TODAY}), 0)::int commission_today,
    (select count(*) from users d
      where d.referred_by=p.id and (d.created_at at time zone 'Asia/Jakarta')::date = ${TODAY})::int
      new_referrals_today,
    now() as now
  from picked p`

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
  /** Soal seminggu terakhir. Dipakai `season_ending`: papan peringkat cuma jadi alasan untuk
   * kembali bagi orang yang memang sedang ikut musimnya. */
  tasks_recent: number
  active_referrals: number
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
  `${formatCredits(credits)} TD (${formatRupiah(creditsToRupiah(credits))})`

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
  /** `fillMissing` menyamakan kebijakannya dengan `loadEconomyConfig` (`parseRow` di `server/economy/economy-config.ts`). Tanpa itu keduanya berselisih tepat di jendela paling rapuh: kode baru sudah live, migrasinya belum jalan. Jalur request tetap melayani dengan nilai bawaan plus peringatan, sementara pengiriman pesan di sini berhenti total — dan berhentinya diam, karena `runMaintenance` menerima `{}` sebagai hasil yang sah, bukan sebagai error. */
  const parsed = validateEconomyConfig(rows[0]?.config, { fillMissing: true })
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
  if (payoutRequiresPremium() && !premium) return false
  if (!row.last_withdrawal_at) return true
  return row.last_withdrawal_at.getTime() + withdrawalCooldownMs(premium) <= row.now.getTime()
}

/** Ajakan penutup yang menyebut angka, bukan "yuk main lagi".
 *
 * Perkiraannya dari reward Sedang 2★ — bukan hasil terbaik, bukan yang terburuk — dan DIJEPIT sisa
 * stok reward. Jepitan itu yang membuatnya jujur: stok yang tinggal sedikit membuat janji besar jadi
 * kalimat yang dibantah aplikasi sendiri begitu user membukanya. */
function invite(poolCredits: number, count = 3): string {
  const estimate = Math.min(Math.max(0, poolCredits), starReward('Medium', 2) * count)
  if (estimate <= 0) return 'Buka app-nya bentar, cek stok reward kamu ya.'
  return `kerjain ${formatCredits(count)} soal aja, kira-kira ${money(estimate)}.`
}

/** Sisa misi "Selesaikan soal" hari ini, atau `null` kalau tidak ada yang pantas dikabari.
 *
 * `isMissionAvailable` ikut diperiksa karena misi harian DIUNDI (migrasi 0048): menyebut misi yang
 * tidak keluar hari ini adalah pesan yang salah, dan user yang membukanya tidak akan menemukan
 * apa pun yang cocok dengan kalimatnya. */
function dailyTasksMissionLeft(
  row: CandidateRow,
  today: string,
): { remaining: number; target: number; reward: number } | null {
  if (row.tasks_today <= 0) return null
  if (!isMissionAvailable('tasks', today)) return null

  const definition = missionDefinition('tasks')
  const remaining = definition.target - row.tasks_today
  if (remaining <= 0 || remaining > MISSION_NUDGE_LEFT) return null
  return { remaining, target: definition.target, reward: definition.reward }
}

/** Musimnya berakhir saat hari WIB berganti nanti malam. Dihitung di sini, bukan ditanyakan ke
 * database, karena batas musim memang turunan tanggal — sama seperti undian misi harian — dan
 * anchor Senin-nya membuat hasilnya identik dengan `seasonBoundsSql` di `server/task/leaderboard.ts`. */
function seasonEndsToday(now: Date): boolean {
  const days = leaderboardSeasonDays()
  if (days <= 0) return false
  const elapsed = daysBetweenWib(SEASON_ANCHOR, wibDayKey(now))
  return ((elapsed % days) + days) % days === days - 1
}

const daysBetweenWib = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Kunci dedup mingguan: ember tujuh hari yang dihitung dari tanggal WIB, bukan nomor minggu ISO.
 * Yang dibutuhkan cuma "sudah pernah minggu ini atau belum", dan aturan minggu ISO menambah kasus
 * pinggir pergantian tahun tanpa menambah satu pun jawaban yang berbeda. */
const weekKey = (now: Date) =>
  `W${Math.floor(daysBetweenWib('1970-01-01', wibDayKey(now)) / 7)}`

/** Ajakan belanja hanya untuk saldo yang benar-benar bisa membeli sesuatu di rak hari ini. Menyuruh
 * orang melihat rak yang seluruh isinya di luar jangkauannya adalah cara tercepat membuat pesan bot
 * berhenti dibuka. */
function storeNudgeFits(row: CandidateRow, balance: number): boolean {
  if (!storeEnabled() || row.tasks_today > 0) return false
  const affordable = storeCatalog()
    .map((item) => item.priceCredits)
    .filter((price): price is number => price !== null)
  return affordable.length > 0 && balance >= Math.min(...affordable)
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
        '',
        `Sambil nunggu diproses, ${invite(pool.current)}`,
      ].join('\n'),
    }
  }

  if (rank.tier > getRank(row.completed_count_before).tier) {
    return {
      kind: 'rank_up',
      dedupeKey: String(rank.tier),
      buttonLabel: '🏅 Coba stok barunya',
      text: [
        `<b>Rank kamu naik jadi ${escapeHtml(rank.name)} 🏅</b>`,
        '',
        `${formatCredits(row.completed_count)} soal kelar. Daya tampung stok reward kamu ikut naik, jadi sekali duduk bisa ngumpulin lebih banyak sebelum stoknya habis.`,
        '',
        `Buktiin sekarang: ${invite(pool.current, 5)}`,
      ].join('\n'),
    }
  }

  if (row.tasks_today === 0 && streak >= 2 && STREAK_REMINDER_HOURS.includes(hour)) {
    return {
      kind: 'streak_risk',
      dedupeKey: today,
      buttonLabel: '🔥 Kerjain 1 soal',
      text: [
        `<b>Streak ${formatCredits(streak)} hari kamu hampir putus 🔥</b>`,
        '',
        'Hari ini belum ada soal yang kelar. Satu aja udah cukup buat nyambungin streak-nya sebelum ganti hari.',
        '',
        'Streak panjang bikin daya tampung stok reward kamu makin gede.',
      ].join('\n'),
    }
  }

  /** Ambangnya "tinggal sedikit", bukan "belum kelar". Misi yang masih menyisakan empat soal bukan
   * ajakan, cuma laporan — dan pesan yang isinya laporan menghabiskan satu-satunya jatah kirim hari
   * itu tanpa memindahkan siapa pun. */
  const missionLeft = dailyTasksMissionLeft(row, today)
  if (missionLeft !== null) {
    return {
      kind: 'mission_ready',
      dedupeKey: today,
      buttonLabel: `🎯 Kelarin ${formatCredits(missionLeft.remaining)} soal lagi`,
      text: [
        `<b>Misi harian kamu tinggal ${formatCredits(missionLeft.remaining)} soal 🎯</b>`,
        '',
        `${formatCredits(row.tasks_today)} dari ${formatCredits(missionLeft.target)} udah kelar hari ini. Kelarin sisanya sebelum ganti hari, hadiahnya ${formatCredits(missionLeft.reward)} energi.`,
        '',
        'Besok misinya diundi ulang, jadi yang hari ini nggak nunggu.',
      ].join('\n'),
    }
  }

  if (row.commission_today > 0) {
    return {
      kind: 'commission_digest',
      dedupeKey: today,
      buttonLabel: '💰 Tambahin sendiri',
      text: [
        '<b>Komisi dari teman kamu masuk 🎉</b>',
        '',
        `Hari ini kamu dapat ${money(row.commission_today)} dari soal yang dikerjain teman-teman kamu. Tanpa ngapa-ngapain.`,
        '',
        `Ditambahin dikit lagi? ${invite(pool.current)}`,
      ].join('\n'),
    }
  }

  if (row.new_referrals_today > 0) {
    return {
      kind: 'referral_joined',
      dedupeKey: today,
      buttonLabel: '🎮 Main bareng',
      text: [
        `<b>${formatCredits(row.new_referrals_today)} teman baru pakai kode kamu 👋</b>`,
        '',
        'Begitu mereka mulai ngerjain soal, komisinya ngalir ke kamu otomatis. Sekalian colek mereka biar cepet mulai ya.',
        '',
        `Kamu juga jangan diem: ${invite(pool.current)}`,
      ].join('\n'),
    }
  }

  /** Musim papan peringkat cuma jadi alasan untuk kembali bagi orang yang memang sedang ikut. User
   * yang seminggu ini tidak menyentuh satu soal pun tidak punya posisi untuk dipertahankan, dan
   * mengabarinya soal musim yang habis cuma bunyi. */
  if (seasonEndsToday(now) && row.tasks_recent > 0 && row.tasks_today === 0) {
    return {
      kind: 'season_ending',
      dedupeKey: today,
      buttonLabel: '🏆 Naikin posisi',
      text: [
        '<b>Musim papan peringkat habis malam ini 🏆</b>',
        '',
        'Besok hitungannya balik dari nol buat semua orang. Posisi kamu sekarang masih bisa digeser.',
        '',
        invite(pool.current, 5),
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
        `Balik bentar aja: ${invite(pool.current)}`,
      ].join('\n'),
    }
  }

  if (idleHours >= 24 * 3) {
    return {
      kind: 'winback_3',
      dedupeKey: wibDayKey(row.last_task_at ?? now),
      buttonLabel: '👀 Ambil stoknya',
      text: [
        '<b>Udah 3 hari nggak mampir 👀</b>',
        '',
        `Energi kamu ${formatCredits(energy.current)}/${formatCredits(energy.max)} dan stok reward-nya nunggu dipakai.`,
        '',
        `Lumayan buat nambah saldo sambil rebahan. ${invite(pool.current)}`,
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
        `Selama masih penuh, stoknya berhenti nambah — jadi sayang kalau didiemin. ${invite(pool.current, 5)}`,
      ].join('\n'),
    }
  }

  /** Ajakan belanja, dan satu-satunya pesan di daftar ini yang tidak menyuruh mengerjakan soal.
   * Sasarannya sempit dengan sengaja: saldo yang cukup untuk membeli sesuatu, penarikan yang belum
   * kebuka, dan tidak ada kabar lain yang lebih pantas hari itu. Kunci dedup-nya mingguan, bukan
   * harian — ajakan belanja yang datang tiap hari berhenti jadi ajakan dan mulai jadi gangguan. */
  if (storeNudgeFits(row, balance)) {
    return {
      kind: 'store_idle',
      dedupeKey: weekKey(now),
      buttonLabel: '🛍️ Lihat isi rak',
      text: [
        `<b>Saldo ${money(balance)} kamu bisa dipakai sekarang 🛍️</b>`,
        '',
        'Penarikan belum kebuka, tapi saldonya nggak harus nganggur: di Toko TD bisa ditukar jadi energi, pass biar soal nggak makan energi, premium, atau bingkai buat papan peringkat.',
        '',
        'Yang nggak mau motong saldo bisa bayar pakai QRIS.',
      ].join('\n'),
    }
  }

  if (energy.current >= maxEnergy(premium) && idleHours >= ENERGY_IDLE_HOURS) {
    return {
      kind: 'energy_full',
      dedupeKey: today,
      buttonLabel: '⚡ Habisin energinya',
      text: [
        '<b>Energi kamu penuh lagi ⚡</b>',
        '',
        `${formatCredits(energy.current)}/${formatCredits(energy.max)} energi siap dipakai. Energi yang udah penuh berhenti ngisi, jadi mending langsung dihabisin.`,
        '',
        invite(pool.current, Math.max(1, energy.current)),
      ].join('\n'),
    }
  }

  /** Jaring terakhir, dan satu-satunya ajakan yang tidak menunggu keadaan khusus apa pun. Tanpa ini
   * user yang hari ini belum menyentuh soal — tapi energinya belum penuh, stoknya belum penuh,
   * streak-nya belum dua hari — tidak menerima satu pun ajakan main, padahal ia persis orang yang
   * paling mudah diajak balik. */
  if (row.tasks_today === 0) {
    return {
      kind: 'daily_invite',
      dedupeKey: today,
      buttonLabel: '🎮 Mulai sekarang',
      text: [
        '<b>Hari ini belum kelar satu soal pun 🎮</b>',
        '',
        `Energi kamu ${formatCredits(energy.current)}/${formatCredits(energy.max)} dan stok reward-nya ${money(pool.current)}.`,
        '',
        invite(pool.current),
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
    query<CandidateRow>(CANDIDATE_SQL, [CANDIDATE_LIMIT]),
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
