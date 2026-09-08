import type { PoolClient } from 'pg'
import { appendLedger } from '../economy/ledger.ts'
import { query, transaction } from '../platform/db.ts'

const CLEANUP_BATCH_SIZE = 100
export const WITHDRAWAL_PREMIUM_CONSTRAINT = 'withdrawals_premium_required'

interface LockedWithdrawal {
  id: string
  user_id: string
  credits: number
  state: string
}

type PremiumGateRow = {
  required: boolean
  premium_until: Date | null
  now: Date
}

export function isWithdrawalPremiumBackstop(error: unknown): boolean {
  return (error as { constraint?: unknown } | null)?.constraint === WITHDRAWAL_PREMIUM_CONSTRAINT
}

export async function isWithdrawalPremiumRequired(tx?: PoolClient): Promise<boolean> {
  const sql = `select coalesce((config ->> 'withdrawalRequiresPremium')::int, 0) > 0 as required
                 from economy_config where id=1`
  const rows = tx
    ? (await tx.query<{ required: boolean }>(sql)).rows
    : await query<{ required: boolean }>(sql)
  return rows[0]?.required ?? false
}

async function readPremiumGate(tx: PoolClient, userId: number): Promise<PremiumGateRow | undefined> {
  return (
    await tx.query<PremiumGateRow>(
      `select coalesce((e.config ->> 'withdrawalRequiresPremium')::int, 0) > 0 as required,
              u.premium_until, now() as now
         from users u cross join economy_config e
        where u.id=$1 and e.id=1
        for update of u`,
      [userId],
    )
  ).rows[0]
}

export interface PremiumCleanupResult {
  cleaned: boolean
  premiumUntil: Date | null
}

export async function refundAndDeleteInactivePremiumWithdrawal(
  tx: PoolClient,
  withdrawal: LockedWithdrawal,
): Promise<PremiumCleanupResult> {
  if (withdrawal.state !== 'processing') return { cleaned: false, premiumUntil: null }

  const userId = Number(withdrawal.user_id)
  const gate = await readPremiumGate(tx, userId)
  if (!gate) return { cleaned: false, premiumUntil: null }
  if (!gate.required || (gate.premium_until?.getTime() ?? 0) > gate.now.getTime()) {
    return { cleaned: false, premiumUntil: gate.premium_until }
  }

  await appendLedger(tx, {
    userId,
    kind: 'withdrawal_refund',
    amount: withdrawal.credits,
    idempotencyKey: `withdrawal_refund:${withdrawal.id}`,
    referenceId: withdrawal.id,
    note: 'Premium tidak aktif sebelum penarikan selesai',
  })
  const deleted = await tx.query(
    `delete from withdrawals where id=$1 and state='processing'`,
    [withdrawal.id],
  )
  return { cleaned: deleted.rowCount === 1, premiumUntil: gate.premium_until }
}

async function cleanupBatch(): Promise<{ selected: number; cleaned: number }> {
  return transaction(async (tx) => {
    const candidates = await tx.query<LockedWithdrawal>(
      `select w.id, w.user_id, w.credits, w.state
         from withdrawals w
         join users u on u.id=w.user_id
        where w.state='processing'
          and (u.premium_until is null or u.premium_until <= now())
        order by w.requested_at
        limit $1
        for update of w`,
      [CLEANUP_BATCH_SIZE],
    )

    let cleaned = 0
    for (const withdrawal of candidates.rows) {
      if ((await refundAndDeleteInactivePremiumWithdrawal(tx, withdrawal)).cleaned) cleaned += 1
    }
    return { selected: candidates.rows.length, cleaned }
  })
}

export async function cleanupInactivePremiumWithdrawals(): Promise<number> {
  if (!(await isWithdrawalPremiumRequired())) return 0

  let total = 0
  for (;;) {
    const batch = await cleanupBatch()
    total += batch.cleaned
    if (batch.selected < CLEANUP_BATCH_SIZE) return total
    if (batch.cleaned === 0 && !(await isWithdrawalPremiumRequired())) return total
  }
}
