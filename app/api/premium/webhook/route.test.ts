import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  settlePremiumPayment: vi.fn(),
  webhookStatusIsPaid: vi.fn(),
  loadEconomyConfig: vi.fn(),
}))

vi.mock('@/server/env', () => ({ env: { appOriginOrNull: null } }))
vi.mock('@/server/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
}))
vi.mock('@/server/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/economy-config', () => ({ loadEconomyConfig: mocks.loadEconomyConfig }))
vi.mock('@/server/notify', () => ({ notifyPremiumActivated: vi.fn() }))
vi.mock('@/server/premium-payment', () => ({
  settlePremiumPayment: mocks.settlePremiumPayment,
  webhookStatusIsPaid: mocks.webhookStatusIsPaid,
}))

import { POST } from './route'

describe('POST /api/premium/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('selalu menjawab opaque untuk payload tanpa order', async () => {
    const response = await POST(
      new Request('https://app.example/api/premium/webhook', {
        method: 'POST',
        body: JSON.stringify({ status: 'paid' }),
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.settlePremiumPayment).not.toHaveBeenCalled()
  })

  it('mengembalikan 401 hanya untuk signature order yang salah', async () => {
    mocks.webhookStatusIsPaid.mockReturnValue(true)
    mocks.settlePremiumPayment.mockResolvedValue({ settled: false, reason: 'bad_signature' })

    const response = await POST(
      new Request('https://app.example/api/premium/webhook', {
        method: 'POST',
        body: JSON.stringify({ order_id: 'order-1', status: 'paid', signature: 'salah' }),
      }),
    )

    expect(response.status).toBe(401)
  })
})
