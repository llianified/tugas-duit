import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'

const gateway = vi.hoisted(() => ({
  creates: 0,
  status: 'PENDING' as 'PENDING' | 'SUCCESS' | 'EXPIRED',
  lastOrderId: '',
}))

vi.mock('../integrations/klikqris', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../integrations/klikqris')>()),
  klikqrisConfigured: () => true,
  createInvoice: vi.fn(async (input: { orderId: string; amountIdr: number }) => {
    gateway.creates += 1
    gateway.lastOrderId = input.orderId
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
}, 120_000)

afterEach(() => {
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
  gateway.creates = 0
  gateway.status = 'PENDING'
})

async function makeUser(): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code) values($1,'Uji Checkout',$2) returning id`,
    [900_000_000_000_000 + suffix, generateReferralCode()],
  )
  return Number(rows[0].id)
}

const countInvoices = async (userId: number, state: string) => {
  const { query } = await import('../platform/db')
  const rows = await query<{ jumlah: number }>(
    'select count(*)::int as jumlah from premium_payments where user_id=$1 and state=$2',
    [userId, state],
  )
  return Number(rows[0].jumlah)
}

describe('PREM-DB-4 — satu tagihan menganggur per user', () => {
  it('mengembalikan tagihan yang sama saat paketnya sama, tanpa memanggil gateway lagi', async () => {
    const { startPremiumCheckout } = await import('./premium-payment')
    const userId = await makeUser()

    const first = await startPremiumCheckout(userId, 2)
    const second = await startPremiumCheckout(userId, 2)

    expect(first.settled).toBe(false)
    expect(second.settled).toBe(false)
    if (first.settled || second.settled) return
    expect(second.invoice.orderId).toBe(first.invoice.orderId)
    expect(gateway.creates).toBe(1)
    expect(await countInvoices(userId, 'pending')).toBe(1)
  })

  it('menghanguskan tagihan lama saat user pindah paket', async () => {
    const { startPremiumCheckout } = await import('./premium-payment')
    const userId = await makeUser()

    const first = await startPremiumCheckout(userId, 1)
    const second = await startPremiumCheckout(userId, 3)

    expect(first.settled).toBe(false)
    expect(second.settled).toBe(false)
    if (first.settled || second.settled) return
    expect(second.invoice.orderId).not.toBe(first.invoice.orderId)
    expect(second.invoice.months).toBe(3)
    expect(gateway.creates).toBe(2)
    expect(await countInvoices(userId, 'pending')).toBe(1)
    expect(await countInvoices(userId, 'expired')).toBe(1)
  })

  it('menyelesaikan tagihan yang ternyata sudah dibayar, bukan membuangnya', async () => {
    const { startPremiumCheckout } = await import('./premium-payment')
    const { query } = await import('../platform/db')
    const userId = await makeUser()

    await startPremiumCheckout(userId, 1)
    gateway.status = 'SUCCESS'

    const again = await startPremiumCheckout(userId, 3)
    expect(again.settled).toBe(true)
    if (!again.settled) return
    expect(again.premiumUntil).toBeGreaterThan(Date.now())

    const rows = await query<{ premium_until: Date | null }>(
      'select premium_until from users where id=$1',
      [userId],
    )
    expect(rows[0].premium_until).not.toBeNull()
    expect(await countInvoices(userId, 'paid')).toBe(1)
    expect(await countInvoices(userId, 'pending')).toBe(0)
  })

  it('menandai tagihan yang sudah kedaluwarsa lalu membuat yang baru', async () => {
    const { startPremiumCheckout } = await import('./premium-payment')
    const { query } = await import('../platform/db')
    const userId = await makeUser()

    const first = await startPremiumCheckout(userId, 1)
    if (first.settled) return
    await query(
      "update premium_payments set expires_at=now()-interval '1 minute' where order_id=$1",
      [first.invoice.orderId],
    )

    const second = await startPremiumCheckout(userId, 1)
    expect(second.settled).toBe(false)
    if (second.settled) return
    expect(second.invoice.orderId).not.toBe(first.invoice.orderId)
    expect(await countInvoices(userId, 'expired')).toBe(1)
    expect(await countInvoices(userId, 'pending')).toBe(1)
  })
})
