import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
  readPayoutProofFileId: vi.fn(),
  readTelegramFile: vi.fn(),
}))

vi.mock('@/server/env', () => ({ env: { appOriginOrNull: 'https://app.example' } }))
vi.mock('@/server/payout', () => ({ readPayoutProofFileId: mocks.readPayoutProofFileId }))
vi.mock('@/server/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireUser: mocks.requireUser,
}))
vi.mock('@/server/telegram', () => ({ readTelegramFile: mocks.readTelegramFile }))

import { GET } from './route'

const id = '11111111-1111-4111-8111-111111111111'
const request = (headers?: HeadersInit) =>
  new Request(`https://app.example/api/withdrawals/${id}/proof`, { headers })
const context = (value = id) => ({ params: Promise.resolve({ id: value }) })

describe('GET /api/withdrawals/:id/proof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 31 })
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('menolak navigasi cross-site sebelum membaca sesi', async () => {
    const response = await GET(request({ 'sec-fetch-site': 'cross-site' }), context())

    expect(response.status).toBe(403)
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })

  it('menolak id bukan UUID tanpa mencari file', async () => {
    const response = await GET(request(), context('../rahasia'))

    expect(response.status).toBe(404)
    expect(mocks.readPayoutProofFileId).not.toHaveBeenCalled()
  })

  it('mencari bukti dengan pasangan user dan withdrawal agar tidak bocor lintas akun', async () => {
    mocks.readPayoutProofFileId.mockResolvedValue('telegram-file-1')
    mocks.readTelegramFile.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    })

    const response = await GET(request(), context())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.readPayoutProofFileId).toHaveBeenCalledWith(31, id)
    expect(mocks.readTelegramFile).toHaveBeenCalledWith('telegram-file-1')
  })
})
