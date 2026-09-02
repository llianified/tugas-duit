import type { PoolClient } from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  maxTasksPerDay: vi.fn(() => 2),
  dailyCommissionCreditCap: vi.fn(() => 10),
  isPremium: vi.fn(() => false),
  readRewardPool: vi.fn(),
  spendRewardPool: vi.fn(),
}))

vi.mock('@/domain/economy', () => ({
  maxTasksPerDay: mocks.maxTasksPerDay,
  dailyCommissionCreditCap: mocks.dailyCommissionCreditCap,
}))
vi.mock('./premium', () => ({ isPremium: mocks.isPremium }))
vi.mock('./reward-pool', () => ({
  readRewardPool: mocks.readRewardPool,
  spendRewardPool: mocks.spendRewardPool,
}))

import { consumeCommissionQuota, consumeQuota } from './quota'

const pool = { available: 7, capacity: 10, updatedAt: Date.now() }
const txWith = (...rows: unknown[][]) => {
  const query = vi.fn()
  for (const value of rows) query.mockResolvedValueOnce({ rows: value })
  return { query } as unknown as PoolClient
}

describe('quota task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readRewardPool.mockResolvedValue(pool)
  })

  it('mengembalikan counter saat task melewati batas harian', async () => {
    const tx = txWith([{ tasks_completed: 3 }], [])

    await expect(consumeQuota(tx, 4, 3)).resolves.toEqual({
      refusal: 'daily_task_cap',
      paidReward: 0,
      pool,
    })

    expect(mocks.spendRewardPool).not.toHaveBeenCalled()
    expect(tx.query).toHaveBeenNthCalledWith(2, expect.stringContaining('greatest(0, tasks_completed-1)'), [4])
  })

  it('tidak mencatat pendapatan ketika reward pool kosong', async () => {
    const emptyPool = { ...pool, available: 0 }
    const tx = txWith([{ tasks_completed: 1 }], [])
    mocks.spendRewardPool.mockResolvedValue({ paid: 0, state: emptyPool })

    await expect(consumeQuota(tx, 4, 3)).resolves.toEqual({
      refusal: 'pool_empty',
      paidReward: 0,
      pool: emptyPool,
    })

    expect(tx.query).toHaveBeenCalledTimes(2)
  })

  it('mencatat hanya reward yang benar-benar dibayar', async () => {
    const tx = txWith([{ tasks_completed: 1 }], [])
    mocks.spendRewardPool.mockResolvedValue({ paid: 2, state: pool })

    await expect(consumeQuota(tx, 4, 3)).resolves.toMatchObject({ refusal: null, paidReward: 2 })

    expect(tx.query).toHaveBeenNthCalledWith(2, expect.stringContaining('credits_earned=credits_earned+$2'), [4, 2])
  })
})

describe('quota komisi', () => {
  it('memotong pembayaran pada sisa plafon, bukan nilai request', async () => {
    const tx = txWith([{ commission_credits: 7 }], [])

    await expect(consumeCommissionQuota(tx, 9, 8)).resolves.toBe(3)
    expect(tx.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('commission_credits=commission_credits+$2'),
      [9, 3],
    )
  })

  it('tidak menyentuh database untuk nilai non-positif', async () => {
    const tx = txWith()

    await expect(consumeCommissionQuota(tx, 9, 0)).resolves.toBe(0)
    expect(tx.query).not.toHaveBeenCalled()
  })
})
