import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  }),
  headers: async () => new Headers(),
}))
vi.mock('../platform/db', () => ({ query: mocks.query, isPreviewShell: () => false }))
vi.mock('../platform/env', () => ({ env: { adminTelegramIdOrNull: null } }))

import {
  BannedError,
  UnauthorizedError,
  createSession,
  destroySession,
  requireUser,
} from './session'

describe('session security', () => {
  beforeEach(() => vi.clearAllMocks())

  it('menolak request tanpa cookie sesi', async () => {
    mocks.cookieGet.mockReturnValue(undefined)
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError)
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('menolak user yang dibekukan', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'token' })
    mocks.query.mockResolvedValue([
      {
        id: '1', public_id: 'user', telegram_id: '9', first_name: 'User', username: null,
        photo_url: null, balance_credits: '0', referral_code: 'ABC', banned_at: new Date(),
        is_admin: false, premium_until: null, channel_bonus_claimed_at: null,
        channel_member: null, channel_checked_at: null,
      },
    ])

    await expect(requireUser()).rejects.toBeInstanceOf(BannedError)
  })

  it('menulis cookie HttpOnly berpartisi dan membatasi sesi aktif', async () => {
    mocks.query.mockResolvedValue([])

    const token = await createSession(42, 'browser')

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'td_session',
      token,
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none', partitioned: true }),
    )
  })

  it('mencabut token dan menghapus cookie dengan atribut yang sama', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'token' })
    mocks.query.mockResolvedValue([])

    await destroySession()

    expect(mocks.query).toHaveBeenCalledOnce()
    expect(mocks.cookieDelete).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'td_session', partitioned: true }),
    )
  })
})
