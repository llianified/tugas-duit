import { execute, query, transaction } from '../platform/db.ts'
import { runEngagementNotifications } from '../messaging/engagement.ts'
import { sweepFraudSignals } from '../task/fraud.ts'

/** Angka-angka ini menyatakan kapan sebuah baris BERHENTI BERGUNA, bukan seberapa cepat ia
 * hilang. Yang menentukan yang kedua adalah jadwal sapuannya, dan jadwal yang benar-benar
 * terdaftar cuma satu: cron harian di `vercel.json` (plan Hobby membatasi cron bawaan ke sekali
 * sehari). Jadi `rate_limits` dan `used_init_data` — dua yang retensinya dihitung dalam jam —
 * pada praktiknya menahan sampai ±24 jam baris mati sebelum disapu, bukan 2 jam dan 1 jam.
 * Keduanya tetap murah dihapus karena kolom retensinya berindeks (`rate_limits_window_idx`,
 * `used_init_data_expires_idx`), dan tidak ada satu pun jalur baca yang terganggu baris mati:
 * `checkRateLimit` memilih per `window_start` yang tepat, dan `verifyInitData` sudah menolak
 * payload kedaluwarsa lebih dulu lewat umurnya sendiri. Yang dibayar hanya penyimpanan.
 *
 * Angkanya tidak dinaikkan untuk "menjujurkan" jadwal, karena itu justru menahan lebih banyak.
 * Kalau penyimpanannya mulai terasa, yang diubah adalah frekuensinya — mendaftarkan pemicu
 * eksternal per jam ke `app/api/cron/maintenance` (jalur yang sudah diantisipasi route-nya)
 * langsung membuat nilai-nilai di bawah ini berlaku apa adanya, tanpa satu pun baris kode
 * berubah. */
const CHALLENGE_RETENTION = '7 days'

const RATE_LIMIT_RETENTION = '2 hours'

const SESSION_RETENTION = '30 days'

const INIT_DATA_RETENTION = '1 hour'

const FRAUD_SIGNAL_RETENTION = '180 days'

const BOT_NOTIFICATION_RETENTION = '90 days'

/** Jendela rekonsiliasi saldo. Bentuk lamanya menjumlahkan SELURUH `credit_ledger` yang di-join ke SELURUH `users` dengan `group by` per user, lalu baru memotongnya dengan `limit 50` — biaya yang naik seiring umur ledger dan pada akhirnya memakan seluruh jatah `maxDuration` route cron sebelum satu pesan pun sempat dikirim. Yang dipersempit hanya himpunan user yang diperiksa, bukan penjumlahannya: saldo hanya bisa melenceng lewat tulisan, dan setiap tulisan saldo (`appendLedger`) ikut menyetel `users.updated_at`. Jadi drift baru selalu berada di dalam jendela ini selama cron berjalan lebih sering daripada panjangnya. */
const BALANCE_CHECK_WINDOW = '3 days'

export type MaintenanceSummary = {
  challenges: number
  rateLimits: number
  sessions: number
  initData: number
  fraudSignals: number
  botNotifications: number
  balanceDrift: number
  swept: Record<string, number>
  notified: Record<string, number>
}

export async function runMaintenance(): Promise<MaintenanceSummary> {
  const challenges = await execute(
    `delete from challenges
      where submitted_at is not null
        and solved = false
        and issued_at < now() - interval '${CHALLENGE_RETENTION}'`,
  )
  console.log(`[maintenance] ${challenges} soal kedaluwarsa dihapus`)

  const rateLimits = await execute(
    `delete from rate_limits where window_start < now() - interval '${RATE_LIMIT_RETENTION}'`,
  )
  console.log(`[maintenance] ${rateLimits} baris rate limit dihapus`)

  const sessions = await execute(
    `delete from sessions
      where expires_at < now() - interval '${SESSION_RETENTION}'
         or (revoked_at is not null and revoked_at < now() - interval '${SESSION_RETENTION}')`,
  )
  console.log(`[maintenance] ${sessions} sesi kedaluwarsa dihapus`)

  const initData = await execute(
    `delete from used_init_data where expires_at < now() - interval '${INIT_DATA_RETENTION}'`,
  )
  console.log(`[maintenance] ${initData} penanda initData dihapus`)

  const fraudSignals = await execute(
    `delete from fraud_signals where created_at < now() - interval '${FRAUD_SIGNAL_RETENTION}'`,
  )
  console.log(`[maintenance] ${fraudSignals} sinyal kedaluwarsa dihapus`)

  const drift = await query<{ id: string; balance_credits: string; ledger_total: string }>(
    `select u.id, u.balance_credits,
            coalesce((select sum(l.amount) from credit_ledger l where l.user_id = u.id), 0)
              as ledger_total
       from users u
      where u.updated_at >= now() - interval '${BALANCE_CHECK_WINDOW}'
        and u.balance_credits <>
            coalesce((select sum(l.amount) from credit_ledger l where l.user_id = u.id), 0)
      limit 50`,
  )
  if (drift.length) {
    console.error(
      `[maintenance] SELISIH SALDO pada ${drift.length} user aktif ${BALANCE_CHECK_WINDOW} terakhir — periksa segera:`,
    )
    for (const row of drift) {
      console.error(
        `[maintenance]   user ${row.id}: saldo ${row.balance_credits}, jumlah ledger ${row.ledger_total}`,
      )
    }
  } else {
    console.log(`[maintenance] rekonsiliasi saldo (${BALANCE_CHECK_WINDOW} terakhir): cocok`)
  }

  const botNotifications = await execute(
    `delete from bot_notifications where sent_at < now() - interval '${BOT_NOTIFICATION_RETENTION}'`,
  )
  console.log(`[maintenance] ${botNotifications} penanda pesan bot dihapus`)

  const swept = await transaction((tx) => sweepFraudSignals(tx))
  for (const [signal, count] of Object.entries(swept)) {
    if (count > 0) console.log(`[maintenance] sinyal ${signal}: ${count} user baru ditandai`)
  }

  let notified: Record<string, number> = {}
  try {
    notified = await runEngagementNotifications()
    for (const [kind, count] of Object.entries(notified)) {
      console.log(`[maintenance] pesan ${kind}: ${count} terkirim`)
    }
  } catch (error) {
    console.error('[maintenance] pesan bot gagal dijalankan', error)
  }

  return {
    challenges,
    rateLimits,
    sessions,
    initData,
    fraudSignals,
    botNotifications,
    balanceDrift: drift.length,
    swept,
    notified,
  }
}
