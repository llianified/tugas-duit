import { pool } from '../server/db.ts'
import { runEngagementNotifications } from '../server/engagement.ts'
import { sweepFraudSignals } from '../server/fraud.ts'

const CHALLENGE_RETENTION = '7 days'

const RATE_LIMIT_RETENTION = '2 hours'

const SESSION_RETENTION = '30 days'

const INIT_DATA_RETENTION = '1 hour'

const FRAUD_SIGNAL_RETENTION = '180 days'

const BOT_NOTIFICATION_RETENTION = '90 days'

async function main() {
  const client = await pool.connect()
  try {
    const challenges = await client.query(
      `delete from challenges
        where submitted_at is not null
          and solved = false
          and issued_at < now() - interval '${CHALLENGE_RETENTION}'`,
    )
    console.log(`[maintenance] ${challenges.rowCount ?? 0} soal kedaluwarsa dihapus`)

    const rateLimits = await client.query(
      `delete from rate_limits where window_start < now() - interval '${RATE_LIMIT_RETENTION}'`,
    )
    console.log(`[maintenance] ${rateLimits.rowCount ?? 0} baris rate limit dihapus`)

    const sessions = await client.query(
      `delete from sessions
        where expires_at < now() - interval '${SESSION_RETENTION}'
           or (revoked_at is not null and revoked_at < now() - interval '${SESSION_RETENTION}')`,
    )
    console.log(`[maintenance] ${sessions.rowCount ?? 0} sesi kedaluwarsa dihapus`)

    const initData = await client.query(
      `delete from used_init_data where expires_at < now() - interval '${INIT_DATA_RETENTION}'`,
    )
    console.log(`[maintenance] ${initData.rowCount ?? 0} penanda initData dihapus`)

    const signals = await client.query(
      `delete from fraud_signals where created_at < now() - interval '${FRAUD_SIGNAL_RETENTION}'`,
    )
    console.log(`[maintenance] ${signals.rowCount ?? 0} sinyal kedaluwarsa dihapus`)

    const drift = await client.query<{ id: string; balance_credits: string; ledger_total: string }>(
      `select u.id, u.balance_credits, coalesce(sum(l.amount), 0) as ledger_total
         from users u
         left join credit_ledger l on l.user_id = u.id
        group by u.id, u.balance_credits
       having u.balance_credits <> coalesce(sum(l.amount), 0)
        limit 50`,
    )
    if (drift.rowCount) {
      console.error(`[maintenance] SELISIH SALDO pada ${drift.rowCount} user — periksa segera:`)
      for (const row of drift.rows) {
        console.error(
          `[maintenance]   user ${row.id}: saldo ${row.balance_credits}, jumlah ledger ${row.ledger_total}`,
        )
      }
    } else {
      console.log('[maintenance] rekonsiliasi saldo: cocok')
    }

    const notices = await client.query(
      `delete from bot_notifications where sent_at < now() - interval '${BOT_NOTIFICATION_RETENTION}'`,
    )
    console.log(`[maintenance] ${notices.rowCount ?? 0} penanda pesan bot dihapus`)

    const swept = await sweepFraudSignals(client)
    for (const [signal, count] of Object.entries(swept)) {
      if (count > 0) console.log(`[maintenance] sinyal ${signal}: ${count} user baru ditandai`)
    }
  } finally {
    client.release()
  }

  try {
    const sent = await runEngagementNotifications()
    for (const [kind, count] of Object.entries(sent)) {
      console.log(`[maintenance] pesan ${kind}: ${count} terkirim`)
    }
  } catch (error) {
    console.error('[maintenance] pesan bot gagal dijalankan', error)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[maintenance] gagal', error)
  process.exit(1)
})
