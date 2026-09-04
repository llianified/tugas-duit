import { randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { TEXT_CHARS } from '@/domain/task/challenge'
import { commissionUnitsForReward, splitUnitsIntoCredits } from '@/domain/economy/referral'
import { appendLedger } from './ledger'
import { consumeCommissionQuota } from './quota'

const REFERRAL_CODE_LENGTH = 8

export function generateReferralCode(): string {
  if (256 % TEXT_CHARS.length !== 0) {
    throw new Error(`TEXT_CHARS (${TEXT_CHARS.length}) tidak membagi 256 — pemetaan byte jadi bias`)
  }
  const bytes = randomBytes(REFERRAL_CODE_LENGTH)
  let code = ''
  for (const byte of bytes) code += TEXT_CHARS[byte % TEXT_CHARS.length]
  return code
}

export async function bindUpline(
  tx: PoolClient,
  input: { userId: number; code: string | null },
) {
  if (!input.code) return
  const found = await tx.query<{ id: string; referred_by: string | null }>(
    'select id,referred_by from users where referral_code=$1 and banned_at is null',
    [input.code.trim().toUpperCase()],
  )
  const up = found.rows[0]
  if (!up || Number(up.id) === input.userId || Number(up.referred_by) === input.userId) return
  await tx.query('update users set referred_by=$2 where id=$1 and referred_by is null', [
    input.userId,
    Number(up.id),
  ])
}

export async function accrueCommission(
  tx: PoolClient,
  input: { downlineId: number; completionId: string; reward: number },
) {
  const users = await tx.query<{ upline_id: string }>(
    `select up.id as upline_id
       from users d join users up on up.id=d.referred_by
      where d.id=$1 and up.banned_at is null`,
    [input.downlineId],
  )
  const upline = users.rows[0]?.upline_id
  if (!upline) return
  const units = commissionUnitsForReward(input.reward)
  if (units <= 0) return
  const inserted = await tx.query<{ id: string }>(
    `insert into referral_commissions(upline_id,downline_id,task_completion_id,reward,commission_units) values($1,$2,$3,$4,$5) on conflict(task_completion_id) do nothing returning id`,
    [Number(upline), input.downlineId, input.completionId, input.reward, units],
  )
  if (!inserted.rows[0]) return
  const wallet = await tx.query<{ pending_units: number }>(
    `insert into referral_wallets(user_id,pending_units) values($1,0) on conflict(user_id) do update set updated_at=now() returning pending_units`,
    [Number(upline)],
  )
  const { credits, remainderUnits } = splitUnitsIntoCredits(
    wallet.rows[0].pending_units + units,
  )
  await tx.query(
    'update referral_wallets set pending_units=$2,updated_at=now() where user_id=$1',
    [Number(upline), remainderUnits],
  )
  if (!credits) return
  const payable = await consumeCommissionQuota(tx, Number(upline), credits)
  if (!payable) return
  const ledger = await appendLedger(tx, {
    userId: Number(upline),
    kind: 'commission',
    amount: payable,
    idempotencyKey: `commission:${inserted.rows[0].id}`,
    referenceId: inserted.rows[0].id,
    note: `Komisi ${payable} credit dari task teman`,
  })
  await tx.query('update referral_commissions set settled_ledger_id=$2 where id=$1', [
    inserted.rows[0].id,
    ledger.ledgerId,
  ])
}
