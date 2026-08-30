import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { PoolClient } from 'pg'
import { premiumPriceIdr, type PremiumMonths } from '@/domain/premium'
import { query, transaction } from './db'
import { env } from './env'
import {
  createInvoice,
  klikqrisConfigured,
  normalizeStatus,
  readInvoiceStatus,
} from './klikqris'
import { grantPremium } from './premium'

export class PremiumPaymentError extends Error {
  code: string
  status: number

  constructor(code: string, status: number) {
    super(code)
    this.name = 'PremiumPaymentError'
    this.code = code
    this.status = status
  }
}

export interface PremiumInvoice {
  orderId: string
  months: PremiumMonths
  amountIdr: number
  totalAmountIdr: number
  qrisUrl: string | null
  expiresAt: number
}

type InvoiceRow = {
  id: string
  user_id: string
  order_id: string
  months: number
  amount_idr: number
  total_amount_idr: number
  state: string
  signature: string
  qris_url: string | null
  expires_at: Date
}

const EXPIRE_STALE_SQL = `update premium_payments set state='expired', updated_at=now()
  where user_id=$1 and state='pending' and expires_at <= now()`

const PENDING_SQL = `select id,user_id,order_id,months,amount_idr,total_amount_idr,state,signature,qris_url,expires_at
  from premium_payments where user_id=$1 and state='pending' limit 1`

const view = (row: InvoiceRow): PremiumInvoice => ({
  orderId: row.order_id,
  months: row.months as PremiumMonths,
  amountIdr: Number(row.amount_idr),
  totalAmountIdr: Number(row.total_amount_idr),
  qrisUrl: row.qris_url,
  expiresAt: row.expires_at.getTime(),
})

function sameSignature(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}

const newOrderId = (userId: number) =>
  `TD-${userId}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`.toUpperCase()

export async function readPendingInvoice(userId: number): Promise<PremiumInvoice | null> {
  await query(EXPIRE_STALE_SQL, [userId])
  const rows = await query<InvoiceRow>(PENDING_SQL, [userId])
  return rows[0] ? view(rows[0]) : null
}

export type CheckoutResult =
  | { ok: true; settled: false; invoice: PremiumInvoice }
  | { ok: true; settled: true; premiumUntil: number }

/**
 * Tagihan lama tidak pernah dibuang tanpa ditanyakan dulu ke gateway. User yang sudah
 * membayar tapi webhook-nya belum sampai akan kehilangan uangnya kalau barisnya kita
 * tandai kedaluwarsa sepihak — jadi statusnya dibaca lebih dulu, dan yang sudah SUCCESS
 * diselesaikan di sini, bukan dilempar.
 */
export async function startPremiumCheckout(
  userId: number,
  months: PremiumMonths,
): Promise<CheckoutResult> {
  if (!klikqrisConfigured()) throw new PremiumPaymentError('PAYMENT_DISABLED', 503)

  await query(EXPIRE_STALE_SQL, [userId])
  const open = (await query<InvoiceRow>(PENDING_SQL, [userId]))[0]

  if (open) {
    const remote = await readInvoiceStatus(open.order_id).catch(() => null)

    if (remote?.status === 'SUCCESS') {
      await settlePremiumPayment(open.order_id, remote.signature, 'gateway')
      const settled = await query<{ granted_until: Date | null; state: string }>(
        'select granted_until, state from premium_payments where id=$1',
        [open.id],
      )
      const paid = settled[0]
      if (paid?.state === 'paid' && paid.granted_until) {
        return { ok: true, settled: true, premiumUntil: paid.granted_until.getTime() }
      }
      throw new PremiumPaymentError('PAYMENT_SETTLE_FAILED', 502)
    }

    if (remote?.status === 'EXPIRED' || Number(open.months) !== months) {
      await query("update premium_payments set state='expired', updated_at=now() where id=$1", [
        open.id,
      ])
    } else {
      return { ok: true, settled: false, invoice: view(open) }
    }
  }

  const amountIdr = premiumPriceIdr(months)
  const orderId = newOrderId(userId)
  const created = await createInvoice({
    orderId,
    amountIdr,
    keterangan: `Premium ${months} bulan — Tugas Duit`,
    callbackUrl: `${env.appOrigin}/api/premium/webhook`,
  })

  const inserted = await query<InvoiceRow>(
    `insert into premium_payments(user_id,order_id,months,amount_idr,total_amount_idr,signature,qris_url,expires_at)
     values($1,$2,$3,$4,$5,$6,$7,$8)
     returning id,user_id,order_id,months,amount_idr,total_amount_idr,state,signature,qris_url,expires_at`,
    [
      userId,
      created.orderId,
      months,
      amountIdr,
      created.totalAmountIdr,
      created.signature,
      created.qrisUrl,
      created.expiresAt,
    ],
  )
  return { ok: true, settled: false, invoice: view(inserted[0]) }
}

export type SettleResult =
  | {
      settled: true
      premiumUntil: number
      userId: number
      telegramId: string
      months: PremiumMonths
    }
  | { settled: false; reason: 'not_found' | 'already_settled' | 'bad_signature' }

/**
 * Satu-satunya pintu yang menyalakan premium. Idempotensinya bertumpu pada
 * `state='pending'` di klausa `where` update terakhir, bukan pada pengecekan sebelumnya:
 * dua webhook yang datang bersamaan membuat yang kedua tidak mengubah baris apa pun.
 */
export async function settlePremiumPayment(
  orderId: string,
  signature: string | null,
  source: 'webhook' | 'gateway',
): Promise<SettleResult> {
  return transaction(async (tx: PoolClient) => {
    const locked = await tx.query<InvoiceRow & { telegram_id: string }>(
      `select p.id,p.user_id,p.order_id,p.months,p.amount_idr,p.total_amount_idr,p.state,
              p.signature,p.qris_url,p.expires_at,u.telegram_id
         from premium_payments p join users u on u.id=p.user_id
        where p.order_id=$1 for update of p`,
      [orderId],
    )
    const row = locked.rows[0]
    if (!row) return { settled: false as const, reason: 'not_found' as const }
    if (row.state === 'paid') return { settled: false as const, reason: 'already_settled' as const }

    if (!signature || !sameSignature(row.signature, signature)) {
      console.warn('[premium] signature %s tidak cocok untuk %s', source, orderId)
      return { settled: false as const, reason: 'bad_signature' as const }
    }

    const months = Number(row.months) as PremiumMonths
    const userId = Number(row.user_id)
    const premiumUntil = await grantPremium(tx, userId, months)

    const updated = await tx.query(
      `update premium_payments
          set state='paid', paid_at=now(), granted_until=$2, updated_at=now()
        where id=$1 and state='pending'`,
      [row.id, premiumUntil],
    )
    if (updated.rowCount === 0) {
      throw new PremiumPaymentError('PAYMENT_STATE_RACE', 409)
    }

    return {
      settled: true as const,
      premiumUntil: premiumUntil.getTime(),
      userId,
      telegramId: row.telegram_id,
      months,
    }
  })
}

export function webhookStatusIsPaid(status: unknown): boolean {
  return normalizeStatus(status) === 'SUCCESS'
}
