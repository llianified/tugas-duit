import { execute, query, transaction } from './db.ts'
import { runEngagementNotifications } from './engagement.ts'
import { sweepFraudSignals } from './fraud.ts'

const CHALLENGE_RETENTION = '7 days'

const RATE_LIMIT_RETENTION = '2 hours'

const SESSION_RETENTION = '30 days'

const INIT_DATA_RETENTION = '1 hour'

const FRAUD_SIGNAL_RETENTION = '180 days'

const BOT_NOTIFICATION_RETENTION = '90 days'

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
    `select u.id, u.balance_credits, coalesce(sum(l.amount), 0) as ledger_total
       from users u
       left join credit_ledger l on l.user_id = u.id
      group by u.id, u.balance_credits
     having u.balance_credits <> coalesce(sum(l.amount), 0)
      limit 50`,
  )
  if (drift.length) {
    console.error(`[maintenance] SELISIH SALDO pada ${drift.length} user — periksa segera:`)
    for (const row of drift) {
      console.error(
        `[maintenance]   user ${row.id}: saldo ${row.balance_credits}, jumlah ledger ${row.ledger_total}`,
      )
    }
  } else {
    console.log('[maintenance] rekonsiliasi saldo: cocok')
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
