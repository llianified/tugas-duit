import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
  recordAdjustment: vi.fn(),
}))

vi.mock('@/server/platform/env', () => ({ env: { appOriginOrNull: 'https://app.example' } }))
vi.mock('@/server/auth/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireUser: mocks.requireUser,
}))
vi.mock('@/server/economy/economy-config', () => ({ loadEconomyConfig: vi.fn() }))
vi.mock('@/server/platform/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/economy/ledger', () => ({ recordAdjustment: mocks.recordAdjustment }))

import { POST } from './route'

describe('POST /api/admin/adjustments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('menyembunyikan endpoint dari user non-admin', async () => {
    mocks.requireUser.mockResolvedValue({ id: 1, isAdmin: false })

    const response = await POST(
      new Request('https://app.example/api/admin/adjustments', {
        method: 'POST',
        headers: { origin: 'https://app.example' },
        body: JSON.stringify({ userId: 'user', credits: 10, note: 'koreksi' }),
      }),
    )

    expect(response.status).toBe(404)
    expect(mocks.recordAdjustment).not.toHaveBeenCalled()
  })

  it('menolak koreksi nol sebelum menulis ledger', async () => {
    mocks.requireUser.mockResolvedValue({ id: 1, firstName: 'Admin', isAdmin: true })

    const response = await POST(
      new Request('https://app.example/api/admin/adjustments', {
        method: 'POST',
        headers: { origin: 'https://app.example' },
        body: JSON.stringify({ userId: 'user', credits: 0, note: 'koreksi' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(mocks.recordAdjustment).not.toHaveBeenCalled()
  })
})
