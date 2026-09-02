import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/db', () => ({ transaction: vi.fn() }))
vi.mock('@/server/env', () => ({ env: { appOriginOrNull: 'https://app.example' } }))
vi.mock('@/server/ratelimit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('@/server/referral', () => ({ bindUpline: vi.fn(), generateReferralCode: vi.fn() }))
vi.mock('@/server/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  createSession: vi.fn(),
}))
vi.mock('@/server/telegram', () => ({ claimInitData: vi.fn(), verifyInitData: vi.fn() }))

import { POST } from './route'

describe('POST /api/auth/telegram', () => {
  it('menolak origin asing sebelum verifikasi init data', async () => {
    const response = await POST(
      new Request('https://app.example/api/auth/telegram', {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
        body: JSON.stringify({ initData: 'palsu' }),
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN_ORIGIN' } })
  })
})
