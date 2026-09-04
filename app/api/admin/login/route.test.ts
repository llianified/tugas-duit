import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loginAdminWithPassword: vi.fn(),
  checkRateLimit: vi.fn(),
  peekRateLimit: vi.fn(),
  recordRateLimitHit: vi.fn(),
  notifyAdminLogin: vi.fn(),
  notifyAdminLoginFlood: vi.fn(),
}))

vi.mock('@/server/auth/admin-auth', () => ({ loginAdminWithPassword: mocks.loginAdminWithPassword }))
vi.mock('@/server/platform/env', () => ({
  env: { appOriginOrNull: 'https://app.example', adminTelegramIdOrNull: '99' },
}))
vi.mock('@/server/messaging/notify', () => ({
  notifyAdminLogin: mocks.notifyAdminLogin,
  notifyAdminLoginFlood: mocks.notifyAdminLoginFlood,
}))
vi.mock('@/server/platform/ratelimit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  peekRateLimit: mocks.peekRateLimit,
  recordRateLimitHit: mocks.recordRateLimitHit,
}))
vi.mock('@/server/auth/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
}))

import { POST } from './route'

const request = (password = 'rahasia') =>
  new Request('https://app.example/api/admin/login', {
    method: 'POST',
    headers: { origin: 'https://app.example', 'x-forwarded-for': '203.0.113.4' },
    body: JSON.stringify({ password }),
  })

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
    mocks.peekRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('menghentikan login saat bucket IP penuh', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfter: 45 })

    const response = await POST(request())

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('45')
    expect(mocks.loginAdminWithPassword).not.toHaveBeenCalled()
  })

  it('mencatat kegagalan sandi pada bucket IP dan global', async () => {
    mocks.loginAdminWithPassword.mockResolvedValue({ ok: false, reason: 'INVALID_PASSWORD' })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const response = await POST(request('salah'))

    expect(response.status).toBe(401)
    expect(mocks.recordRateLimitHit).toHaveBeenNthCalledWith(1, 'admin-login-failures:203.0.113.4', 3_600)
    expect(mocks.recordRateLimitHit).toHaveBeenNthCalledWith(2, 'admin-login-failures', 3_600)
    expect(mocks.peekRateLimit).toHaveBeenCalledWith('admin-login-failures', 500, 3_600)
  })

  /** P1-01. Ember global 500/jam dipakai bersama seluruh IP, jadi ±25 IP yang masing-masing berhenti di bawah plafon per-IP sudah cukup mengisinya — dan selama pemeriksaannya berdiri SEBELUM sandi diverifikasi, admin yang mengetik sandi benar ikut dijawab 429. Pemrosesan payout berhenti bersamanya, tanpa satu pun peringatan terkirim. */
  it('tetap meloloskan sandi yang benar walau ember global sudah penuh', async () => {
    mocks.loginAdminWithPassword.mockResolvedValue({ ok: true })
    mocks.peekRateLimit.mockImplementation(async (bucket: string) =>
      bucket === 'admin-login-failures'
        ? { allowed: false, retryAfter: 900 }
        : { allowed: true, retryAfter: 0 },
    )
    vi.spyOn(console, 'info').mockImplementation(() => undefined)

    const response = await POST(request())

    expect(response.status).toBe(204)
    expect(mocks.notifyAdminLogin).toHaveBeenCalled()
  })

  it('memberi kabar ke pemilik saat ember global penuh, lalu menjawab 429', async () => {
    mocks.loginAdminWithPassword.mockResolvedValue({ ok: false, reason: 'INVALID_PASSWORD' })
    mocks.peekRateLimit.mockImplementation(async (bucket: string) =>
      bucket === 'admin-login-failures'
        ? { allowed: false, retryAfter: 900 }
        : { allowed: true, retryAfter: 0 },
    )
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const response = await POST(request('salah'))

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('900')
    expect(mocks.notifyAdminLoginFlood).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '99', failures: 500 }),
    )
  })

  it('mengembalikan 204 dan memberi tahu pemilik setelah sesi berhasil dibuat', async () => {
    mocks.loginAdminWithPassword.mockResolvedValue({ ok: true })
    vi.spyOn(console, 'info').mockImplementation(() => undefined)

    const response = await POST(request())

    expect(response.status).toBe(204)
    expect(mocks.notifyAdminLogin).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '99', ip: '203.0.113.4' }),
    )
  })
})
