import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
  startPremiumCheckout: vi.fn(),
}))

vi.mock('@/server/platform/env', () => ({ env: { appOriginOrNull: 'https://app.example' } }))
vi.mock('@/server/economy/economy-config', () => ({ loadEconomyConfig: vi.fn() }))
vi.mock('@/server/platform/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/auth/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireUser: mocks.requireUser,
}))
vi.mock('@/server/premium/premium-payment', () => {
  class PremiumPaymentError extends Error {
    constructor(public code: string, public status: number) {
      super(code)
    }
  }
  return { PremiumPaymentError, startPremiumCheckout: mocks.startPremiumCheckout }
})

import { POST } from './route'

const request = (body: unknown) =>
  new Request('https://app.example/api/premium/checkout', {
    method: 'POST',
    headers: { origin: 'https://app.example' },
    body: JSON.stringify(body),
  })

describe('POST /api/premium/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 17 })
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('menolak paket di luar daftar server-side', async () => {
    const response = await POST(request({ months: 12 }))

    expect(response.status).toBe(400)
    expect(mocks.startPremiumCheckout).not.toHaveBeenCalled()
  })

  it('membatasi checkout per user sebelum membuat invoice', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 })

    const response = await POST(request({ months: 1 }))

    expect(response.status).toBe(429)
    expect(mocks.startPremiumCheckout).not.toHaveBeenCalled()
  })

  it('mendelegasikan paket valid ke checkout yang mengatur harga dan idempotensi', async () => {
    mocks.startPremiumCheckout.mockResolvedValue({
      settled: false,
      invoice: { orderId: 'order-1', months: 2, amountIdr: 1, totalAmountIdr: 1 },
    })

    const response = await POST(request({ months: 2 }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.startPremiumCheckout).toHaveBeenCalledWith(17, 2)
  })
})
