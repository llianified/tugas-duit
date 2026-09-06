import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'

/** Gateway palsu yang bentuknya sama dengan yang dipakai `premium-payment.test.ts`: satu tempat
 * mengatur status yang dijawab `/qris/status`, dan signature yang bisa ditebak supaya uji bisa
 * mengirim callback yang benar DAN yang salah. */
const gateway = vi.hoisted(() => ({
  creates: 0,
  status: 'PENDING' as 'PENDING' | 'SUCCESS' | 'EXPIRED',
}))

vi.mock('../integrations/klikqris', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../integrations/klikqris')>()),
  klikqrisConfigured: () => true,
  createInvoice: vi.fn(async (input: { orderId: string; amountIdr: number }) => {
    gateway.creates += 1
    return {
      orderId: input.orderId,
      amountIdr: input.amountIdr,
      totalAmountIdr: input.amountIdr + 17,
      signature: `sig-${input.orderId}`,
      qrisUrl: 'https://klikqris.test/qr.png',
      qrisImage: null,
      expiresAt: new Date(Date.now() + 3_600_000),
    }
  }),
  readInvoiceStatus: vi.fn(async (orderId: string) => ({
    orderId,
    status: gateway.status,
    signature: `sig-${orderId}`,
    totalAmountIdr: 0,
  })),
}))

beforeAll(async () => {
  delete process.env.DATABASE_URL
  process.env.APP_ORIGIN = 'https://uji.tugasduit.test'
  const { query } = await import('../platform/db')
  await query('select 1')
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

afterEach(() => {
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
  gateway.creates = 0
  gateway.status = 'PENDING'
})

async function makeUser(pool = 30): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,reward_pool,reward_pool_updated_at)
     values($1,'Uji Toko Tunai',$2,$3,now()) returning id`,
    [920_000_000_000_000 + suffix, generateReferralCode(), pool],
  )
  return Number(rows[0].id)
}

const openOrder = async (userId: number, key = 'gaspol_pass') => {
  const { startCashCheckout } = await import('./cash-order')
  const result = await startCashCheckout(userId, key)
  if (!result.ok || result.settled) throw new Error('tagihan gagal terbit')
  return result.order
}

/** SHOP-1 — pelunasan tunai: barangnya diserahkan tepat sekali, dan cuma untuk callback yang asli.
 *
 * Ini jalur uang kedua di aplikasi ini, dan setiap penjagaan di sini menirukan yang sudah dibayar
 * mahal oleh jalur premium: signature membuktikan callback-nya asli, nominal adalah pertanyaan
 * terpisah, dan pelunasan kedua tidak boleh menyerahkan barang untuk kedua kalinya. */
describe('SHOP-1 — pelunasan pesanan tunai', () => {
  it('menerbitkan satu tagihan dan mengembalikan tagihan yang sama saat diminta lagi', async () => {
    const userId = await makeUser()

    const pertama = await openOrder(userId)
    const kedua = await openOrder(userId)

    expect(kedua.orderId).toBe(pertama.orderId)
    expect(gateway.creates).toBe(1)
  })

  it('menyerahkan barangnya saat signature dan nominalnya cocok', async () => {
    const { settleCashOrder } = await import('./cash-order')
    const { query } = await import('../platform/db')
    const userId = await makeUser()
    const order = await openOrder(userId)

    const settled = await settleCashOrder(
      order.orderId,
      `sig-${order.orderId}`,
      'webhook',
      order.totalAmountIdr,
    )

    expect(settled).toMatchObject({ settled: true, itemKey: 'gaspol_pass' })
    const rows = await query<{ gaspol_until: Date | null }>(
      'select gaspol_until from users where id=$1',
      [userId],
    )
    expect(rows[0].gaspol_until).not.toBeNull()
  })

  /** Signature yang salah adalah POST karangan ke endpoint yang URL-nya publik. Yang dijaga bukan
   * cuma penolakannya, melainkan bahwa TIDAK ADA jejak barang yang sempat diberikan. */
  it('menolak signature yang tidak cocok tanpa menyerahkan apa pun', async () => {
    const { settleCashOrder } = await import('./cash-order')
    const { query } = await import('../platform/db')
    const userId = await makeUser()
    const order = await openOrder(userId)

    expect(await settleCashOrder(order.orderId, 'sig-ngawur', 'webhook', order.totalAmountIdr))
      .toEqual({ settled: false, reason: 'bad_signature' })

    const rows = await query<{ gaspol_until: Date | null }>(
      'select gaspol_until from users where id=$1',
      [userId],
    )
    expect(rows[0].gaspol_until).toBeNull()
  })

  /** Signature membuktikan callback-nya asli, bukan bahwa nominalnya lunas. Dua pertanyaan berbeda,
   * dan yang kedua dibandingkan dengan `total_amount_idr` — yang benar-benar ditagih setelah
   * KlikQRIS menambahkan kode unik — bukan harga raknya. */
  it('menolak nominal yang kurang walau signature-nya asli', async () => {
    const { settleCashOrder } = await import('./cash-order')
    const userId = await makeUser()
    const order = await openOrder(userId)

    expect(
      await settleCashOrder(
        order.orderId,
        `sig-${order.orderId}`,
        'webhook',
        order.totalAmountIdr - 1,
      ),
    ).toEqual({ settled: false, reason: 'amount_mismatch' })
  })

  /** Gateway mengulang kirim webhook. Pelunasan kedua harus berhenti di `state='paid'`, bukan
   * memperpanjang jendela Gaspol untuk kedua kalinya. */
  it('menolak pelunasan kedua tanpa menambah apa pun', async () => {
    const { settleCashOrder } = await import('./cash-order')
    const { query } = await import('../platform/db')
    const userId = await makeUser()
    const order = await openOrder(userId)

    await settleCashOrder(order.orderId, `sig-${order.orderId}`, 'webhook', order.totalAmountIdr)
    const sesudah = await query<{ gaspol_until: Date }>(
      'select gaspol_until from users where id=$1',
      [userId],
    )

    expect(
      await settleCashOrder(order.orderId, `sig-${order.orderId}`, 'webhook', order.totalAmountIdr),
    ).toEqual({ settled: false, reason: 'already_settled' })

    const lagi = await query<{ gaspol_until: Date }>('select gaspol_until from users where id=$1', [
      userId,
    ])
    expect(lagi[0].gaspol_until.getTime()).toBe(sesudah[0].gaspol_until.getTime())
  })

  it('membalas pesanan yang tidak dikenal tanpa membocorkan bahwa ia tidak ada', async () => {
    const { settleCashOrder } = await import('./cash-order')
    expect(await settleCashOrder('TDS-TIDAK-ADA', 'sig-apa-saja', 'webhook', 1_000)).toEqual({
      settled: false,
      reason: 'not_found',
    })
  })

  /** Penolakan raknya diperiksa sebelum satu QR pun terbit: menyuruh orang membayar barang yang
   * sudah pasti tidak berguna baginya adalah kerugian uang sungguhan, bukan TD. */
  it('menolak menerbitkan QR untuk barang yang sudah pasti tidak berguna', async () => {
    const { startCashCheckout } = await import('./cash-order')
    const userId = await makeUser(0)

    expect(await startCashCheckout(userId, 'gaspol_pass')).toEqual({
      ok: false,
      reason: 'pool_empty',
    })
    expect(gateway.creates).toBe(0)
  })

  it('menolak barang yang memang tidak dijual lewat QRIS', async () => {
    const { startCashCheckout } = await import('./cash-order')
    const userId = await makeUser()

    expect(await startCashCheckout(userId, 'premium_month')).toEqual({
      ok: false,
      reason: 'payment_unavailable',
    })
    expect(gateway.creates).toBe(0)
  })

  /** Jaring untuk webhook yang hilang di jalan: tagihan lama yang ternyata sudah dibayar
   * diselesaikan saat user membuka checkout lagi, bukan dibuang lalu diganti QR baru. */
  it('menyelesaikan tagihan lama yang ternyata sudah dibayar saat checkout dibuka lagi', async () => {
    const { startCashCheckout } = await import('./cash-order')
    const userId = await makeUser()
    await openOrder(userId)

    gateway.status = 'SUCCESS'
    expect(await startCashCheckout(userId, 'gaspol_pass')).toEqual({
      ok: true,
      settled: true,
      itemKey: 'gaspol_pass',
    })
  })
})
