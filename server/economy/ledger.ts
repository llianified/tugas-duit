import type { PoolClient } from 'pg'
import { transaction } from '../platform/db.ts'
type LedgerKind = 'task'|'commission'|'withdrawal_hold'|'withdrawal_refund'|'adjustment'|'purchase'

export async function appendLedger(tx: PoolClient, entry: { userId:number; kind:LedgerKind; amount:number; idempotencyKey:string; referenceId?:string; note?:string }): Promise<{ balance:number; ledgerId:number }> {
  const locked = await tx.query<{ balance_credits:string }>('select balance_credits from users where id=$1 for update', [entry.userId])
  if (!locked.rows[0]) throw new Error('User tidak ditemukan')
  /** Dicari dalam lingkup user yang sama, bukan seluruh tabel. `idempotency_key` unik global, jadi pencarian tanpa `user_id` membuat kunci milik orang lain ikut menjawab "sudah pernah dibayar" — dan yang dikembalikannya saldo PEMANGGIL, sehingga permintaan yang tidak pernah dibukukan terbaca sukses. Kunci yang datang dari klien (`adjustment:`, `store:`) karena itu ikut membawa id usernya, supaya bentrok lintas user tidak bisa terjadi sejak awal alih-alih ditangkap belakangan sebagai pelanggaran unique. */
  const existing = await tx.query<{ id:string }>('select id from credit_ledger where idempotency_key=$1 and user_id=$2', [entry.idempotencyKey, entry.userId])
  if (existing.rows[0]) return { balance:Number(locked.rows[0].balance_credits), ledgerId:Number(existing.rows[0].id) }
  const updated = await tx.query<{ balance_credits:string }>('update users set balance_credits=balance_credits+$2,updated_at=now() where id=$1 returning balance_credits', [entry.userId, entry.amount])
  const balance = Number(updated.rows[0].balance_credits)
  const inserted = await tx.query<{ id:string }>(`insert into credit_ledger(user_id,kind,amount,balance_after,idempotency_key,reference_id,note) values($1,$2,$3,$4,$5,$6,$7) returning id`, [entry.userId,entry.kind,entry.amount,balance,entry.idempotencyKey,entry.referenceId??null,entry.note??null])
  return { balance, ledgerId:Number(inserted.rows[0].id) }
}

/** `requestId` datang dari klien, dan itu memang syaratnya. Setiap jalur uang lain memakai kunci deterministik — `task:<challengeId>`, `commission:<commissionId>`, `withdrawal:<id>` — sehingga permintaan yang diulang membaca baris yang sudah ada alih-alih membayar dua kali. Koreksi admin tidak punya id alami seperti itu: yang menandai "koreksi yang sama" cuma satu klik yang sama, dan hanya klien yang tahu itu. UUID yang dibuat server tidak pernah bisa cocok dengan dirinya sendiri, jadi mekanisme idempotensi `appendLedger` tidak pernah berlaku untuknya — dan klik ganda mencetak koreksi kedua senilai penuh. */
export async function recordAdjustment(input: {
  adminId: number
  adminName: string
  userPublicId: string
  credits: number
  note: string
  requestId: string
}): Promise<{ balance: number; ledgerId: number } | null> {
  return transaction(async (tx) => {
    const found = await tx.query<{ id: string }>('select id from users where public_id=$1', [input.userPublicId])
    if (!found.rows[0]) return null
    const userId = Number(found.rows[0].id)
    return appendLedger(tx, {
      userId,
      kind: 'adjustment',
      amount: input.credits,
      idempotencyKey: `adjustment:${userId}:${input.requestId}`,
      referenceId: String(input.adminId),
      note: `${input.note} — oleh ${input.adminName} (#${input.adminId})`,
    })
  })
}
