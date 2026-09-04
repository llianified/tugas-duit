import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
  createPayout: vi.fn(),
}))

vi.mock('@/server/platform/env', () => ({ env: { appOriginOrNull: 'https://app.example' } }))
vi.mock('@/server/auth/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireUser: mocks.requireUser,
}))
vi.mock('@/server/economy/economy-config', () => ({ loadEconomyConfig: vi.fn() }))
vi.mock('@/server/platform/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/messaging/notify', () => ({ notifyWithdrawalRequested: vi.fn() }))
vi.mock('@/server/payout/payout', () => ({
  createPayout: mocks.createPayout,
  getPayouts: vi.fn(),
  PayoutError: class PayoutError extends Error {},
}))

import { POST } from './route'

describe('POST /api/withdrawals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 1, telegramId: '9' })
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('menolak body dengan credits pecahan', async () => {
    const response = await POST(
      new Request('https://app.example/api/withdrawals', {
        method: 'POST',
        headers: { origin: 'https://app.example' },
        body: JSON.stringify({
          channelId: 'dana',
          accountNumber: '081234567890',
          accountName: 'Budi',
          credits: 100.5,
        }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_FAILED' } })
    expect(mocks.createPayout).not.toHaveBeenCalled()
  })
})
