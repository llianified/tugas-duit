import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createSession: vi.fn(),
  matchesSecret: vi.fn(),
}))

vi.mock('../platform/db', () => ({ query: mocks.query }))
vi.mock('../platform/env', () => ({
  env: {
    adminPasswordOrNull: 'rahasia-admin-yang-panjang-sekali',
    adminTelegramIdOrNull: '123456',
  },
}))
vi.mock('../platform/secret', () => ({ matchesSecret: mocks.matchesSecret }))
vi.mock('./session', () => ({ createSession: mocks.createSession }))

import { loginAdminWithPassword } from './admin-auth'

describe('admin password login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.matchesSecret.mockReturnValue(true)
  })

  it('menolak sandi salah sebelum menyentuh database', async () => {
    mocks.matchesSecret.mockReturnValue(false)

    await expect(loginAdminWithPassword('salah', null)).resolves.toEqual({
      ok: false,
      reason: 'INVALID_PASSWORD',
    })
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('menolak admin yang tidak dikenal atau dibekukan', async () => {
    mocks.query.mockResolvedValueOnce([])
    await expect(loginAdminWithPassword('benar', null)).resolves.toEqual({
      ok: false,
      reason: 'UNKNOWN_ADMIN',
    })

    mocks.query.mockResolvedValueOnce([{ id: '7', banned_at: new Date(), is_admin: true }])
    await expect(loginAdminWithPassword('benar', null)).resolves.toEqual({
      ok: false,
      reason: 'BANNED',
    })
  })

  it('membuat sesi hanya untuk pemilik yang valid', async () => {
    mocks.query.mockResolvedValue([{ id: '7', banned_at: null, is_admin: true }])

    await expect(loginAdminWithPassword('benar', 'browser')).resolves.toEqual({ ok: true })
    expect(mocks.createSession).toHaveBeenCalledWith(7, 'browser')
  })
})
