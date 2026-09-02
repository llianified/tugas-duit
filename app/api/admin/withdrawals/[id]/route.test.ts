import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
  settlePayout: vi.fn(),
  notifyWithdrawalPaid: vi.fn(),
  notifyWithdrawalRejected: vi.fn(),
  savePayoutProof: vi.fn(),
}))

vi.mock('@/server/env', () => ({ env: { appOriginOrNull: 'https://app.example' } }))
vi.mock('@/server/economy-config', () => ({ loadEconomyConfig: vi.fn() }))
vi.mock('@/server/notify', () => ({
  notifyWithdrawalPaid: mocks.notifyWithdrawalPaid,
  notifyWithdrawalRejected: mocks.notifyWithdrawalRejected,
}))
vi.mock('@/server/payout-proof', () => ({ readPayoutProof: vi.fn() }))
vi.mock('@/server/ratelimit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/server/session', () => ({
  BannedError: class BannedError extends Error {},
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireUser: mocks.requireUser,
}))
vi.mock('@/server/payout', () => {
  class PayoutError extends Error {
    constructor(public code: string, public status: number) {
      super(code)
    }
  }
  return {
    PayoutError,
    settlePayout: mocks.settlePayout,
    savePayoutProof: mocks.savePayoutProof,
  }
})

import { PATCH } from './route'

const request = (body: unknown) =>
  new Request('https://app.example/api/admin/withdrawals/wd-1', {
    method: 'PATCH',
    headers: { origin: 'https://app.example', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const context = { params: Promise.resolve({ id: 'wd-1' }) }

describe('PATCH /api/admin/withdrawals/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('menyembunyikan endpoint dari user non-admin', async () => {
    mocks.requireUser.mockResolvedValue({ id: 7, isAdmin: false })

    const response = await PATCH(request({ action: 'paid' }), context)

    expect(response.status).toBe(404)
    expect(mocks.settlePayout).not.toHaveBeenCalled()
  })

  it('menolak settlement rejected tanpa alasan', async () => {
    mocks.requireUser.mockResolvedValue({ id: 7, isAdmin: true })

    const response = await PATCH(request({ action: 'rejected', reason: '  ' }), context)

    expect(response.status).toBe(400)
    expect(mocks.settlePayout).not.toHaveBeenCalled()
  })

  it('menerjemahkan replay settlement menjadi konflik', async () => {
    mocks.requireUser.mockResolvedValue({ id: 7, isAdmin: true })
    const { PayoutError } = await import('@/server/payout')
    mocks.settlePayout.mockRejectedValue(new PayoutError('ALREADY_SETTLED', 409))

    const response = await PATCH(request({ action: 'paid' }), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'ALREADY_SETTLED' } })
  })
})
