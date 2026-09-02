import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  submitAnswer: vi.fn(),
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock('@/server/env', () => ({ env: { appOriginOrNull: 'https://app.example' } }))
vi.mock('@/server/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireUser: mocks.requireUser,
}))
vi.mock('@/server/economy-config', () => ({ loadEconomyConfig: vi.fn() }))
vi.mock('@/server/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/challenge', () => ({ submitAnswer: mocks.submitAnswer }))

import { POST } from './route'

describe('POST /api/task/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 1 })
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('memetakan challenge kedaluwarsa menjadi 410', async () => {
    mocks.submitAnswer.mockResolvedValue({ ok: false, reason: 'expired' })

    const response = await POST(
      new Request('https://app.example/api/task/submit', {
        method: 'POST',
        headers: { origin: 'https://app.example' },
        body: JSON.stringify({ challengeId: 'challenge-1', answer: 'A' }),
      }),
    )

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'CHALLENGE_EXPIRED' } })
  })
})
