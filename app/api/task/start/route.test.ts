import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
  channelGateBlocks: vi.fn(),
  startChallenge: vi.fn(),
}))

vi.mock('@/server/env', () => ({ env: { appOriginOrNull: 'https://app.example' } }))
vi.mock('@/server/economy-config', () => ({ loadEconomyConfig: vi.fn() }))
vi.mock('@/server/channel', () => ({ channelGateBlocks: mocks.channelGateBlocks }))
vi.mock('@/server/challenge', () => ({ startChallenge: mocks.startChallenge }))
vi.mock('@/server/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/session', () => {
  class UnauthorizedError extends Error {}
  return {
    BannedError: class BannedError extends Error {},
    UnauthorizedError,
    requireUser: mocks.requireUser,
  }
})

import { POST } from './route'

const request = (body: unknown) =>
  new Request('https://app.example/api/task/start', {
    method: 'POST',
    headers: { origin: 'https://app.example' },
    body: JSON.stringify(body),
  })

describe('POST /api/task/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 23 })
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
    mocks.channelGateBlocks.mockResolvedValue(false)
  })

  it('menolak user tanpa sesi', async () => {
    const { UnauthorizedError } = await import('@/server/session')
    mocks.requireUser.mockRejectedValue(new UnauthorizedError())

    const response = await POST(request({ challengeId: 'challenge-1' }))

    expect(response.status).toBe(401)
    expect(mocks.startChallenge).not.toHaveBeenCalled()
  })

  it('menghentikan request saat rate limit penuh', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfter: 20 })

    const response = await POST(request({ challengeId: 'challenge-1' }))

    expect(response.status).toBe(429)
    expect(mocks.startChallenge).not.toHaveBeenCalled()
  })

  it('tidak mengonsumsi challenge saat channel wajib belum diikuti', async () => {
    mocks.channelGateBlocks.mockResolvedValue(true)

    const response = await POST(request({ challengeId: 'challenge-1' }))

    expect(response.status).toBe(403)
    expect(mocks.startChallenge).not.toHaveBeenCalled()
  })

  it('mengembalikan state energi tanpa membuat error generik', async () => {
    mocks.startChallenge.mockResolvedValue({
      ok: false,
      reason: 'energy_empty',
      energy: { value: 0 },
    })

    const response = await POST(request({ challengeId: 'challenge-1' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'ENERGY_EMPTY' } })
  })
})
