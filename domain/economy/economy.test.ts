import { describe, expect, it } from 'vitest'
import {
  creditsToRupiah,
  firstWithdrawalEstimateDays,
  getWithdrawalStatus,
  maxPayoutCredits,
  withdrawalMinimumCredits,
} from './economy'
import { rewardPoolCreditsPerDay } from './reward-pool'

describe('economy invariants', () => {
  it('converts credits using one exact integer exchange rate', () => {
    expect(creditsToRupiah(0)).toBe(0)
    expect(creditsToRupiah(125)).toBe(12_500)
  })

  it('derives the first-withdrawal estimate from the minimum and the pool refill rate', () => {
    expect(firstWithdrawalEstimateDays()).toBe(
      Math.ceil(withdrawalMinimumCredits() / rewardPoolCreditsPerDay()),
    )
    expect(firstWithdrawalEstimateDays() * rewardPoolCreditsPerDay()).toBeGreaterThanOrEqual(
      withdrawalMinimumCredits(),
    )
  })

  it('never estimates less than a single day, however fast the pool refills', () => {
    expect(firstWithdrawalEstimateDays()).toBeGreaterThanOrEqual(1)
  })

  it('rejects an exchange rate that would make economy constants fractional', async () => {
    for (const value of [withdrawalMinimumCredits(), maxPayoutCredits()]) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('marks the exact withdrawal boundary as eligible', () => {
    expect(getWithdrawalStatus(withdrawalMinimumCredits() - 1)).toEqual({
      eligible: false,
      remainingCredits: 1,
      remainingRupiah: 100,
    })
    expect(getWithdrawalStatus(withdrawalMinimumCredits())).toEqual({
      eligible: true,
      remainingCredits: 0,
      remainingRupiah: 0,
    })
  })
})
