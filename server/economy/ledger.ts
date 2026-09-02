import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { transaction } from '../platform/db'
type LedgerKind = 'task'|'commission'|'withdrawal_hold'|'withdrawal_refund'|'adjustment'

export async function appendLedger(tx: PoolClient, entry: { userId:number; kind:LedgerKind; amount:number; idempotencyKey:string; referenceId?:string; note?:string }): Promise<{ balance:number; ledgerId:number }> {
  const locked = await tx.query<{ balance_credits:string }>('select balance_credits from users where id=$1 for update', [entry.userId])
  if (!locked.rows[0]) throw new Error('User tidak ditemukan')
  const existing = await tx.query<{ id:string }>('select id from credit_ledger where idempotency_key=$1', [entry.idempotencyKey])
  if (existing.rows[0]) return { balance:Number(locked.rows[0].balance_credits), ledgerId:Number(existing.rows[0].id) }
  const updated = await tx.query<{ balance_credits:string }>('update users set balance_credits=balance_credits+$2,updated_at=now() where id=$1 returning balance_credits', [entry.userId, entry.amount])
  const balance = Number(updated.rows[0].balance_credits)
  const inserted = await tx.query<{ id:string }>(`insert into credit_ledger(user_id,kind,amount,balance_after,idempotency_key,reference_id,note) values($1,$2,$3,$4,$5,$6,$7) returning id`, [entry.userId,entry.kind,entry.amount,balance,entry.idempotencyKey,entry.referenceId??null,entry.note??null])
  return { balance, ledgerId:Number(inserted.rows[0].id) }
}

export async function recordAdjustment(input: {
  adminId: number
  adminName: string
  userPublicId: string
  credits: number
  note: string
}): Promise<{ balance: number; ledgerId: number } | null> {
  return transaction(async (tx) => {
    const found = await tx.query<{ id: string }>('select id from users where public_id=$1', [input.userPublicId])
    if (!found.rows[0]) return null
    return appendLedger(tx, {
      userId: Number(found.rows[0].id),
      kind: 'adjustment',
      amount: input.credits,
      idempotencyKey: `adjustment:${randomUUID()}`,
      referenceId: String(input.adminId),
      note: `${input.note} — oleh ${input.adminName} (#${input.adminId})`,
    })
  })
}
