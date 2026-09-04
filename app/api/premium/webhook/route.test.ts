import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  settlePremiumPayment: vi.fn(),
  webhookStatusIsPaid: vi.fn(),
  loadEconomyConfig: vi.fn(),
}))

vi.mock('@/server/platform/env', () => ({ env: { appOriginOrNull: null } }))
vi.mock('@/server/auth/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
}))
vi.mock('@/server/platform/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/economy/economy-config', () => ({ loadEconomyConfig: mocks.loadEconomyConfig }))
vi.mock('@/server/messaging/notify', () => ({ notifyPremiumActivated: vi.fn() }))
vi.mock('@/server/premium/premium-payment', () => ({
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

  /** P3-01. Balasan untuk signature yang salah harus SAMA dengan balasan untuk order yang tidak dikenal. `bad_signature` cuma mungkin terjadi kalau ordernya ada dan belum lunas, jadi status yang berbeda untuk kasus itu adalah oracle keberadaan — persis yang komentar di route-nya menjanjikan tidak ada. */
  it('tidak membocorkan keberadaan order lewat status signature yang salah', async () => {
    mocks.webhookStatusIsPaid.mockReturnValue(true)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const kirim = async () =>
      POST(
        new Request('https://app.example/api/premium/webhook', {
          method: 'POST',
          body: JSON.stringify({ order_id: 'order-1', status: 'paid', signature: 'salah' }),
        }),
      )

    mocks.settlePremiumPayment.mockResolvedValue({ settled: false, reason: 'bad_signature' })
    const adaTapiSalah = await kirim()

    mocks.settlePremiumPayment.mockResolvedValue({ settled: false, reason: 'not_found' })
    const tidakAda = await kirim()

    expect(adaTapiSalah.status).toBe(200)
    expect(adaTapiSalah.status).toBe(tidakAda.status)
    await expect(adaTapiSalah.json()).resolves.toEqual(await tidakAda.json())
  })
})
