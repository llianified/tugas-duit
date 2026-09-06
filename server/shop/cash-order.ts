import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { PoolClient } from 'pg'
import {
  findStoreItem,
  findStoreItemForFulfilment,
  isStoreItemKey,
  storeEnabled,
  storePrice,
  storePurchaseRefusal,
  type StoreItem,
  type StoreItemKey,
  type StorePurchaseRefusal,
} from '@/domain/store/store'
import {
  createInvoice,
  klikqrisConfigured,
  readInvoiceStatus,
  type InvoiceStatus,
} from '../integrations/klikqris'
import { query, transaction } from '../platform/db'
import { env } from '../platform/env'
import { applyStoreEffect } from '../store/effects'
import { readPurchaseState, STORE_USER_SELECT, type StoreUserRow } from '../store/purchase-state'

/** Pesanan tunai untuk barang Toko TD — jalur QRIS di luar premium.
 *
 * Bentuknya sengaja cermin `server/premium/premium-payment.ts`, sampai ke urutan pemeriksaannya.
 * Itu bukan salin-tempel yang malas: berkas itu memegang setiap pelajaran yang sudah dibayar uang
 * sungguhan — tagihan lama tidak pernah dibuang tanpa ditanyakan ke gateway, gateway bisu berarti
 * "tidak tahu" dan bukan "tidak dibayar", signature membuktikan callback-nya asli sementara nominal
 * adalah pertanyaan terpisah, dan yang menolak pelunasan kedua adalah `state='paid'` dan bukan
 * "state harus pending". Menulis ulang jalur uang kedua tanpa membawa semuanya berarti membayar
 * ulang harganya.
 *
 * Yang BEDA dari premium cuma satu, dan itu disengaja: tidak ada `granted_until` di sini. Barang
 * toko habis diberikan saat pelunasan, jadi yang menjaga idempotensinya `state='paid'` di baris
 * pesanan, bukan kolom hasil. */

export class CashOrderError extends Error {
  code: string
  status: number

  constructor(code: string, status: number) {
    super(code)
    this.name = 'CashOrderError'
    this.code = code
    this.status = status
  }
}

export interface CashOrder {
  orderId: string
  itemKey: StoreItemKey
  itemTitle: string
  amountIdr: number
  totalAmountIdr: number
  qrisUrl: string | null
  expiresAt: number
}

type OrderRow = {
  id: string
  user_id: string
  order_id: string
  product_key: string
  amount_idr: number
  total_amount_idr: number
  state: string
  signature: string
  qris_url: string | null
  expires_at: Date
}

const COLUMNS =
  'id,user_id,order_id,product_key,amount_idr,total_amount_idr,state,signature,qris_url,expires_at'

/** Kolom yang sama, beralias `o`, untuk kueri pelunasan yang menggabungkan `users`. Ditulis utuh
 * dan bukan diturunkan dari `COLUMNS` lewat `split`/`join`: kueri yang menentukan uang berpindah
 * tidak pantas dirakit dengan trik string yang harus dibaca dua kali untuk dipercaya. */
const COLUMNS_JOINED =
  'o.id,o.user_id,o.order_id,o.product_key,o.amount_idr,o.total_amount_idr,o.state,o.signature,o.qris_url,o.expires_at'

const EXPIRE_STALE_SQL = `update cash_orders set state='expired', updated_at=now()
  where user_id=$1 and state='pending' and expires_at <= now()`

const PENDING_SQL = `select ${COLUMNS} from cash_orders where user_id=$1 and state='pending' limit 1`

/** Tagihan yang baru saja ditandai kedaluwarsa dan belum pernah lunas. Alasannya sama persis dengan
 * `RECENTLY_EXPIRED_SQL` di premium: webhook adalah jalur utamanya tapi ia bisa hilang sama sekali,
 * dan tanpa pembacaan ini tidak ada yang pernah menanyakan nasib pembayaran itu lagi. Satu baris
 * terbaru, 24 jam ke belakang — penyelamat pembayaran yang baru saja terjadi, bukan sapuan
 * rekonsiliasi. */
const RECENTLY_EXPIRED_SQL = `select ${COLUMNS} from cash_orders
 where user_id=$1 and state='expired' and paid_at is null
   and expires_at > now() - interval '24 hours'
 order by expires_at desc limit 1`

function view(row: OrderRow, item: StoreItem): CashOrder {
  return {
    orderId: row.order_id,
    itemKey: item.key,
    itemTitle: item.title,
    amountIdr: Number(row.amount_idr),
    totalAmountIdr: Number(row.total_amount_idr),
    qrisUrl: row.qris_url,
    expiresAt: row.expires_at.getTime(),
  }
}

function sameSignature(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}

/** Awalan `TDS`, bukan `TD` yang dipakai premium. Dua tabel pesanan berbagi satu ruang `order_id`
 * di gateway, dan awalan yang sama membuat pesanan toko dan pesanan premium mustahil dibedakan
 * saat menelusuri pembayaran yang bermasalah. */
const newOrderId = (userId: number) =>
  `TDS-${userId}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`.toUpperCase()

/** Barang dari sebuah baris pesanan, dicari di katalog PENUH. Rak kosmetik yang ditutup admin
 * tidak boleh membatalkan penyerahan pesanan yang sudah terbit sebelum saklarnya dimatikan —
 * saklar tampilan tidak boleh berubah jadi saklar yang menelan pembayaran orang. `null` cuma
 * terjadi kalau key-nya benar-benar dicabut dari kode. */
function itemOf(row: OrderRow): StoreItem | null {
  return isStoreItemKey(row.product_key) ? findStoreItemForFulfilment(row.product_key) : null
}

export type CashOrderState = 'pending' | 'paid' | 'expired' | 'failed'

/** Pesanan tunai TERAKHIR beserta keadaannya, bukan cuma yang menggantung.
 *
 * Bedanya menentukan satu kalimat yang dibaca user setelah ia menutup aplikasi banknya. Kalau yang
 * dikirim hanya pesanan `pending`, klien cuma tahu "tagihannya sudah tidak ada" — dan itu jawaban
 * yang sama persis untuk pembayaran yang berhasil dan tagihan yang kedaluwarsa. Yang pertama pantas
 * dijawab "barangnya sudah masuk", yang kedua "QR-nya sudah lewat, bikin lagi ya". Dengan
 * `state` ikut terkirim, klien tidak perlu menebak. */
export async function readLatestCashOrder(
  userId: number,
): Promise<(CashOrder & { state: CashOrderState }) | null> {
  await query(EXPIRE_STALE_SQL, [userId])
  const row = (
    await query<OrderRow>(
      `select ${COLUMNS} from cash_orders where user_id=$1 order by created_at desc limit 1`,
      [userId],
    )
  )[0]
  if (!row) return null
  const item = itemOf(row)
  return item ? { ...view(row, item), state: row.state as CashOrderState } : null
}

export type CashCheckoutResult =
  | { ok: true; settled: false; order: CashOrder }
  | { ok: true; settled: true; itemKey: StoreItemKey }
  | { ok: false; reason: StorePurchaseRefusal }

async function settleFromGateway(
  row: OrderRow,
  remote: InvoiceStatus,
): Promise<CashCheckoutResult> {
  const settled = await settleCashOrder(
    row.order_id,
    remote.signature,
    'gateway',
    remote.totalAmountIdr || null,
  )
  if (settled.settled) return { ok: true, settled: true, itemKey: settled.itemKey }
  if (settled.reason === 'already_settled') {
    const item = itemOf(row)
    if (item) return { ok: true, settled: true, itemKey: item.key }
  }
  throw new CashOrderError('PAYMENT_SETTLE_FAILED', 502)
}

/** Menerbitkan QR untuk satu barang, atau menyelesaikan tagihan lama yang ternyata sudah dibayar.
 *
 * Penolakan raknya diperiksa DI SINI, sebelum satu QR pun terbit: menyuruh orang membayar barang
 * yang sudah pasti tidak berguna baginya — energi saat stoknya penuh, Tarik Sekarang saat tidak ada
 * jeda yang menahan, bingkai yang sudah dimiliki — adalah cara tercepat membuat fitur berbayar
 * dibenci, dan di jalur tunai kerugiannya uang sungguhan, bukan TD. */
export async function startCashCheckout(
  userId: number,
  key: string,
): Promise<CashCheckoutResult> {
  if (!klikqrisConfigured()) throw new CashOrderError('PAYMENT_DISABLED', 503)
  if (!storeEnabled()) return { ok: false, reason: 'store_disabled' }
  if (!isStoreItemKey(key)) return { ok: false, reason: 'unknown_item' }
  const item = findStoreItem(key)
  if (!item) return { ok: false, reason: 'unknown_item' }
  const amountIdr = storePrice(item, 'cash')
  if (amountIdr === null) return { ok: false, reason: 'payment_unavailable' }

  await query(EXPIRE_STALE_SQL, [userId])
  const open = (await query<OrderRow>(PENDING_SQL, [userId]))[0]

  if (open) {
    const remote = await readInvoiceStatus(open.order_id).catch(() => null)

    if (remote?.status === 'SUCCESS') return settleFromGateway(open, remote)

    /** Tagihan lama hanya dibuang kalau gateway benar-benar menjawab. `remote === null` berarti
     * statusnya TIDAK diketahui — gateway timeout atau menolak — dan membuang tagihan atas dasar
     * itu bisa menghapus tagihan yang sebenarnya sudah dibayar. Karena itu permintaan barang lain
     * saat gateway bisu dijawab dengan tagihan yang masih berjalan, bukan tagihan baru. */
    const openItem = itemOf(open)
    const stillRunning =
      openItem !== null &&
      (remote === null || (remote.status !== 'EXPIRED' && open.product_key === item.key))
    if (stillRunning && openItem) return { ok: true, settled: false, order: view(open, openItem) }

    await query("update cash_orders set state='expired', updated_at=now() where id=$1", [open.id])
  }

  /** Jaring untuk webhook yang hilang di jalan, sama seperti premium: tanpa ini, pembayaran yang
   * mendarat setelah `EXPIRE_STALE_SQL` menandai barisnya tidak punya satu pun pembaca lagi. */
  const stale = (await query<OrderRow>(RECENTLY_EXPIRED_SQL, [userId]))[0]
  if (stale) {
    const remote = await readInvoiceStatus(stale.order_id).catch(() => null)
    if (remote?.status === 'SUCCESS') return settleFromGateway(stale, remote)
  }

  const refusal = await transaction(async (tx) => {
    const row = (await tx.query<StoreUserRow>(STORE_USER_SELECT, [userId])).rows[0]
    if (!row) return 'unknown_item' as StorePurchaseRefusal
    return storePurchaseRefusal(item, await readPurchaseState(tx, userId, row), 'cash')
  })
  if (refusal) return { ok: false, reason: refusal }

  const orderId = newOrderId(userId)
  const created = await createInvoice({
    orderId,
    amountIdr,
    keterangan: `${item.title} — Tugas Duit`,
    callbackUrl: `${env.appOrigin}/api/shop/webhook`,
  })

  const inserted = await query<OrderRow>(
    `insert into cash_orders(user_id,order_id,product_key,amount_idr,total_amount_idr,price_credits_at_purchase,signature,qris_url,expires_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning ${COLUMNS}`,
    [
      userId,
      created.orderId,
      item.key,
      amountIdr,
      created.totalAmountIdr,
      item.priceCredits,
      created.signature,
      created.qrisUrl,
      created.expiresAt,
    ],
  )
  return { ok: true, settled: false, order: view(inserted[0], item) }
}

export type CashSettleResult =
  | {
      settled: true
      userId: number
      telegramId: string
      itemKey: StoreItemKey
      itemTitle: string
    }
  | {
      settled: false
      reason: 'not_found' | 'already_settled' | 'bad_signature' | 'amount_mismatch' | 'unknown_item'
    }

/** Satu-satunya pintu yang menyerahkan barang tunai.
 *
 * Yang menolak pelunasan kedua hanya `state='paid'`, BUKAN "state harus 'pending'". Bedanya uang
 * sungguhan, dan alasannya sama persis dengan `settlePremiumPayment`: `expires_at` kita dihitung
 * dari `Date.now() + expired_menit` dan sengaja jatuh lebih awal daripada kedaluwarsa milik
 * gateway, jadi ada jendela nyata ketika user membayar tagihan yang sudah kita tandai `expired`.
 * Menuntut `state='pending'` di klausa `where` update terakhir membuat pembayaran di jendela itu
 * melempar, seluruh transaksinya di-rollback, dan webhook menjawab 500 selamanya: uang masuk,
 * barang tidak pernah diberikan. Idempotensinya bersandar pada `for update of o`. */
export async function settleCashOrder(
  orderId: string,
  signature: string | null,
  source: 'webhook' | 'gateway',
  paidAmountIdr: number | null = null,
): Promise<CashSettleResult> {
  return transaction(async (tx: PoolClient) => {
    const locked = await tx.query<OrderRow & { telegram_id: string }>(
      `select ${COLUMNS_JOINED}, u.telegram_id
         from cash_orders o join users u on u.id=o.user_id
        where o.order_id=$1 for update of o`,
      [orderId],
    )
    const row = locked.rows[0]
    if (!row) return { settled: false as const, reason: 'not_found' as const }
    if (row.state === 'paid') return { settled: false as const, reason: 'already_settled' as const }

    if (!signature || !sameSignature(row.signature, signature)) {
      console.warn('[shop] signature %s tidak cocok untuk %s', source, orderId)
      return { settled: false as const, reason: 'bad_signature' as const }
    }

    /** Signature membuktikan callback-nya asli, bukan bahwa nominalnya lunas — dua pertanyaan
     * berbeda. Yang dibandingkan `total_amount_idr`, yang benar-benar ditagih setelah KlikQRIS
     * menambahkan kode unik, bukan harga raknya. */
    if (paidAmountIdr !== null && paidAmountIdr < Number(row.total_amount_idr)) {
      console.warn(
        '[shop] nominal %s kurang untuk %s: dibayar %d, ditagih %d',
        source,
        orderId,
        paidAmountIdr,
        Number(row.total_amount_idr),
      )
      return { settled: false as const, reason: 'amount_mismatch' as const }
    }

    const item = itemOf(row)
    /** Barang yang key-nya hilang dari katalog tidak bisa diserahkan, dan menandai pesanannya lunas
     * berarti menelan uangnya diam-diam. Barisnya ditinggalkan `pending` supaya ia muncul lagi di
     * pembacaan berikutnya dan terlihat sebagai pembayaran yang menuntut penyelesaian tangan. */
    if (!item) {
      console.error('[shop] barang %s tidak ada di katalog, pesanan %s belum diserahkan', row.product_key, orderId)
      return { settled: false as const, reason: 'unknown_item' as const }
    }

    const userId = Number(row.user_id)

    /** Kosmetik yang ternyata sudah dimiliki berarti user membayar dua kali untuk barang yang sama
     * — hampir selalu karena ia menebusnya pakai TD sementara QR-nya sedang menggantung. Pesanannya
     * tetap ditandai lunas (uangnya memang sudah masuk, dan meninggalkannya `pending` cuma membuat
     * gateway mengulang kirim), tapi kejadiannya dicatat lengkap dengan `order_id` supaya bisa
     * dikembalikan tangan. Tidak ada jalur pengembalian otomatis di aplikasi ini. */
    if (item.effect.kind === 'cosmetic') {
      const owned = await tx.query(
        'select 1 from user_cosmetics where user_id=$1 and cosmetic_key=$2 limit 1',
        [userId, item.effect.cosmetic],
      )
      if (owned.rows.length > 0) {
        console.error('[shop] %s dibayar padahal sudah dimiliki user %d — perlu refund manual', orderId, userId)
      }
    }

    await applyStoreEffect(tx, userId, item)

    const updated = await tx.query(
      `update cash_orders set state='paid', paid_at=now(), updated_at=now()
        where id=$1 and state <> 'paid'`,
      [row.id],
    )
    /** Jaring terakhir. Kalau ia sampai kena 0 baris, melempar adalah caranya membatalkan
     * `applyStoreEffect` yang sudah telanjur jalan di transaksi yang sama. */
    if (updated.rowCount === 0) throw new CashOrderError('PAYMENT_STATE_RACE', 409)

    return {
      settled: true as const,
      userId,
      telegramId: row.telegram_id,
      itemKey: item.key,
      itemTitle: item.title,
    }
  })
}
