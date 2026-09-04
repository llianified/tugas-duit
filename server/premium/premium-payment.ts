import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { PoolClient } from 'pg'
import { premiumPriceIdr, type PremiumMonths } from '@/domain/economy/premium'
import { query, transaction } from '../platform/db'
import { env } from '../platform/env'
import {
  createInvoice,
  klikqrisConfigured,
  normalizeStatus,
  readInvoiceStatus,
  type InvoiceStatus,
} from '../integrations/klikqris'
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

/** Tagihan yang baru saja kita tandai kedaluwarsa dan belum pernah lunas. Webhook adalah jalur utamanya, tapi ia bisa hilang sama sekali — gateway gagal memanggil, atau panggilannya mendarat saat deploy sedang berganti. Tanpa pembacaan ini tidak ada yang pernah menanyakan nasib tagihan itu lagi: `PENDING_SQL` hanya melihat baris `pending`, jadi user yang membuka checkout lagi cuma mendapat QR baru sementara pembayaran lamanya menggantung tanpa pemilik. Satu baris terbaru saja, dan hanya 24 jam ke belakang: ini penyelamat pembayaran yang baru saja terjadi, bukan sapuan rekonsiliasi. Batas itu juga yang menjaga ongkosnya — paling banyak satu panggilan gateway tambahan, dan hanya saat user benar-benar membuka checkout. */
const RECENTLY_EXPIRED_SQL = `select id,user_id,order_id,months,amount_idr,total_amount_idr,state,signature,qris_url,expires_at
  from premium_payments
 where user_id=$1 and state='expired' and paid_at is null
   and expires_at > now() - interval '24 hours'
 order by expires_at desc limit 1`

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

async function settleFromGateway(
  invoice: InvoiceRow,
  remote: InvoiceStatus,
): Promise<CheckoutResult> {
  await settlePremiumPayment(
    invoice.order_id,
    remote.signature,
    'gateway',
    remote.totalAmountIdr || null,
  )
  const settled = await query<{ granted_until: Date | null; state: string }>(
    'select granted_until, state from premium_payments where id=$1',
    [invoice.id],
  )
  const paid = settled[0]
  if (paid?.state === 'paid' && paid.granted_until) {
    return { ok: true, settled: true, premiumUntil: paid.granted_until.getTime() }
  }
  throw new PremiumPaymentError('PAYMENT_SETTLE_FAILED', 502)
}

/** Tagihan lama tidak pernah dibuang tanpa ditanyakan dulu ke gateway. User yang sudah membayar tapi webhook-nya belum sampai akan kehilangan uangnya kalau barisnya kita tandai kedaluwarsa sepihak — jadi statusnya dibaca lebih dulu, dan yang sudah SUCCESS diselesaikan di sini, bukan dilempar. */
export async function startPremiumCheckout(
  userId: number,
  months: PremiumMonths,
): Promise<CheckoutResult> {
  if (!klikqrisConfigured()) throw new PremiumPaymentError('PAYMENT_DISABLED', 503)

  await query(EXPIRE_STALE_SQL, [userId])
  const open = (await query<InvoiceRow>(PENDING_SQL, [userId]))[0]

  if (open) {
    const remote = await readInvoiceStatus(open.order_id).catch(() => null)

    if (remote?.status === 'SUCCESS') return settleFromGateway(open, remote)

    /** Tagihan lama hanya dibuang kalau gateway benar-benar menjawab. `remote === null` berarti statusnya TIDAK diketahui — gateway timeout atau menolak — dan membuang tagihan atas dasar itu bisa menghapus tagihan yang sebenarnya sudah dibayar. Karena itu permintaan ganti paket saat gateway bisu dijawab dengan tagihan yang masih berjalan, bukan dengan tagihan baru: user bisa mencoba lagi sebentar lagi, dan tidak ada uang yang menggantung tanpa pemilik. */
    if (remote === null) return { ok: true, settled: false, invoice: view(open) }

    if (remote.status === 'EXPIRED' || Number(open.months) !== months) {
      await query("update premium_payments set state='expired', updated_at=now() where id=$1", [
        open.id,
      ])
    } else {
      return { ok: true, settled: false, invoice: view(open) }
    }
  }

  /** Sebelum menerbitkan QR baru, tagihan yang baru saja kedaluwarsa ditanyakan sekali ke gateway. Ini jaring untuk webhook yang hilang di jalan: tanpanya, pembayaran yang mendarat setelah `EXPIRE_STALE_SQL` menandai barisnya tidak punya satu pun pembaca lagi. Gateway bisu diperlakukan sebagai "tidak tahu", bukan "tidak dibayar" — checkout lanjut seperti biasa dan barisnya tetap menunggu untuk ditanyakan lagi nanti. */
  const stale = (await query<InvoiceRow>(RECENTLY_EXPIRED_SQL, [userId]))[0]
  if (stale) {
    const remote = await readInvoiceStatus(stale.order_id).catch(() => null)
    if (remote?.status === 'SUCCESS') return settleFromGateway(stale, remote)
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
  | {
      settled: false
      reason: 'not_found' | 'already_settled' | 'bad_signature' | 'amount_mismatch'
    }

/** Satu-satunya pintu yang menyalakan premium. Yang menolak pelunasan kedua hanya `state='paid'`, BUKAN "state harus 'pending'". Bedanya uang sungguhan: `expires_at` kita dihitung dari `Date.now() + expired_menit` (lihat `createInvoice`) dan sengaja jatuh lebih awal daripada kedaluwarsa milik gateway, jadi ada jendela nyata ketika user membayar tagihan yang sudah kita tandai `expired`. Versi sebelumnya menuntut `state='pending'` di klausa `where` update terakhir, sehingga pembayaran di jendela itu melempar `PAYMENT_STATE_RACE`, seluruh transaksinya di-rollback, dan webhook menjawab 500 selamanya: uang masuk, premium tidak pernah menyala, dan tidak ada satu baris pun yang mencatat bahwa itu terjadi. Idempotensinya sekarang bersandar pada `for update of p` di baris tagihannya: webhook kedua menunggu yang pertama commit, lalu membaca `state='paid'` dan berhenti di situ. Klausa `state <> 'paid'` pada update tinggal jaring terakhir — kalau ia sampai kena 0 baris, melempar adalah caranya membatalkan `grantPremium` yang sudah telanjur jalan di transaksi yang sama. */
export async function settlePremiumPayment(
  orderId: string,
  signature: string | null,
  source: 'webhook' | 'gateway',
  paidAmountIdr: number | null = null,
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

    /** Signature membuktikan callback-nya asli, bukan bahwa nominalnya lunas. Keduanya pertanyaan berbeda, dan hanya yang pertama yang selama ini diperiksa. Nominal yang dibandingkan `total_amount_idr` — yang benar-benar ditagih setelah KlikQRIS menambahkan kode unik — bukan harga paketnya. */
    if (paidAmountIdr !== null && paidAmountIdr < Number(row.total_amount_idr)) {
      console.warn(
        '[premium] nominal %s kurang untuk %s: dibayar %d, ditagih %d',
        source,
        orderId,
        paidAmountIdr,
        Number(row.total_amount_idr),
      )
      return { settled: false as const, reason: 'amount_mismatch' as const }
    }

    const months = Number(row.months) as PremiumMonths
    const userId = Number(row.user_id)
    const premiumUntil = await grantPremium(tx, userId, months)

    const updated = await tx.query(
      `update premium_payments
          set state='paid', paid_at=now(), granted_until=$2, updated_at=now()
        where id=$1 and state <> 'paid'`,
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
