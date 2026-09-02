import { describe, expect, it } from 'vitest'
import {
  applyRewardPoolRefund,
  applyRewardPoolSpend,
  baseRewardPoolCredits,
  projectRewardPool,
  rewardPoolCapacity,
  rewardPoolCreditsPerDay,
  rewardPoolRegenMs,
} from './reward-pool'

const T0 = 1_700_000_000_000

/** Kapasitas bawaan, dipakai sebagai kolam netral untuk pengujian regen dan belanja. */
const CAP = baseRewardPoolCredits()

describe('reward pool capacity', () => {
  it('applies bounded rank and streak bonuses to the pool capacity', () => {
    expect(baseRewardPoolCredits()).toBe(30)
    expect(rewardPoolCapacity({ rankTier: 1, streak: 0 })).toBe(30)
    expect(rewardPoolCapacity({ rankTier: 3, streak: 14 })).toBe(38)
    expect(rewardPoolCapacity({ rankTier: 5, streak: 28 })).toBe(46)
    expect(rewardPoolCapacity({ rankTier: 99, streak: 999 })).toBe(46)
  })

  it('clamps ranks and streaks that fall outside their real range', () => {
    expect(rewardPoolCapacity({ rankTier: 0, streak: 0 })).toBe(30)
    expect(rewardPoolCapacity({ rankTier: -5, streak: -20 })).toBe(30)
  })

  it('grows the capacity, never the refill rate', () => {
    const perDay = rewardPoolCreditsPerDay()
    expect(rewardPoolCapacity({ rankTier: 5, streak: 28 })).toBeGreaterThan(
      rewardPoolCapacity({ rankTier: 1, streak: 0 }),
    )
    expect(rewardPoolCreditsPerDay()).toBe(perDay)
  })
})

describe('reward pool regen', () => {
  it('adds one refill step per full interval and none before it', () => {
    const snapshot = { credits: 0, updatedAt: T0 }
    expect(projectRewardPool(snapshot, CAP, T0 + rewardPoolRegenMs() - 1).current).toBe(0)
    expect(projectRewardPool(snapshot, CAP, T0 + rewardPoolRegenMs()).current).toBe(1)
    expect(projectRewardPool(snapshot, CAP, T0 + 3 * rewardPoolRegenMs()).current).toBe(3)
  })

  it('never projects above the capacity it was given', () => {
    expect(projectRewardPool({ credits: 0, updatedAt: T0 }, CAP, T0 + 999 * rewardPoolRegenMs())).toEqual(
      { current: CAP, max: CAP, regenCredits: 1, nextAt: null, fullAt: null },
    )
  })

  it('fills to the larger capacity that rank and streak unlock', () => {
    const bigger = rewardPoolCapacity({ rankTier: 5, streak: 28 })
    const state = projectRewardPool({ credits: 0, updatedAt: T0 }, bigger, T0 + 999 * rewardPoolRegenMs())
    expect(state.current).toBe(bigger)
    expect(state.current).toBeGreaterThan(CAP)
  })

  it('clamps stored credits that sit above the current capacity', () => {
    expect(projectRewardPool({ credits: 99, updatedAt: T0 }, CAP, T0).current).toBe(CAP)
  })

  it('treats an unusable stored value as an empty pool', () => {
    expect(projectRewardPool({ credits: Number.NaN, updatedAt: T0 }, CAP, T0).current).toBe(0)
    expect(projectRewardPool({ credits: -8, updatedAt: T0 }, CAP, T0).current).toBe(0)
  })

  it('does not burn leftover minutes across repeated reads', () => {
    const snapshot = { credits: 0, updatedAt: T0 }
    const almost = rewardPoolRegenMs() - 60_000
    expect(projectRewardPool(snapshot, CAP, T0 + almost).current).toBe(0)
    expect(projectRewardPool(snapshot, CAP, T0 + almost + 60_000).current).toBe(1)
  })

  it('announces the next and full timestamps from the advanced anchor', () => {
    const state = projectRewardPool(
      { credits: CAP - 2, updatedAt: T0 },
      CAP,
      T0 + rewardPoolRegenMs() + rewardPoolRegenMs() / 2,
    )
    expect(state.current).toBe(CAP - 1)
    expect(state.nextAt).toBe(T0 + 2 * rewardPoolRegenMs())
    expect(state.fullAt).toBe(T0 + 2 * rewardPoolRegenMs())
  })

  it('ignores clocks that run backwards', () => {
    expect(projectRewardPool({ credits: 4, updatedAt: T0 }, CAP, T0 - 99 * rewardPoolRegenMs()).current).toBe(4)
  })
})

describe('reward pool spend', () => {
  it('pays the full reward while the pool can cover it', () => {
    const spent = applyRewardPoolSpend({ credits: 10, updatedAt: T0 }, CAP, T0, 4)
    expect(spent.paid).toBe(4)
    expect(spent.snapshot.credits).toBe(6)
  })

  it('pays only what is left instead of refusing the last task', () => {
    const spent = applyRewardPoolSpend({ credits: 2, updatedAt: T0 }, CAP, T0, 5)
    expect(spent.paid).toBe(2)
    expect(spent.snapshot.credits).toBe(0)
    expect(spent.state.current).toBe(0)
  })

  it('starts the refill clock when spending from a full pool', () => {
    const now = T0 + 50 * rewardPoolRegenMs()
    const spent = applyRewardPoolSpend({ credits: CAP, updatedAt: T0 }, CAP, now, 4)
    expect(spent.paid).toBe(4)
    expect(spent.snapshot).toEqual({ credits: CAP - 4, updatedAt: now })
    expect(spent.state.nextAt).toBe(now + rewardPoolRegenMs())
  })

  it('keeps the pending minutes when spending below full', () => {
    const now = T0 + rewardPoolRegenMs() / 2
    const spent = applyRewardPoolSpend({ credits: 5, updatedAt: T0 }, CAP, now, 3)
    expect(spent.snapshot).toEqual({ credits: 2, updatedAt: T0 })
    expect(spent.state.nextAt).toBe(T0 + rewardPoolRegenMs())
  })

  it('spends the credits regen already added, not just the stored ones', () => {
    const now = T0 + 3 * rewardPoolRegenMs()
    const spent = applyRewardPoolSpend({ credits: 0, updatedAt: T0 }, CAP, now, 3)
    expect(spent.paid).toBe(3)
    expect(spent.snapshot.credits).toBe(0)
  })

  it('pays nothing and leaves the snapshot untouched when the pool is empty', () => {
    const snapshot = { credits: 0, updatedAt: T0 }
    const now = T0 + rewardPoolRegenMs() / 2
    const spent = applyRewardPoolSpend(snapshot, CAP, now, 3)
    expect(spent.paid).toBe(0)
    expect(spent.snapshot).toBe(snapshot)
    expect(spent.state.nextAt).toBe(T0 + rewardPoolRegenMs())
  })

  it('ignores a reward that is zero or negative', () => {
    const snapshot = { credits: 9, updatedAt: T0 }
    expect(applyRewardPoolSpend(snapshot, CAP, T0, 0).paid).toBe(0)
    expect(applyRewardPoolSpend(snapshot, CAP, T0, -5).paid).toBe(0)
    expect(applyRewardPoolSpend(snapshot, CAP, T0, -5).snapshot).toBe(snapshot)
  })
})

describe('reward pool refund', () => {
  it('returns credits without ever exceeding the capacity', () => {
    expect(applyRewardPoolRefund({ credits: 4, updatedAt: T0 }, CAP, T0, 3).snapshot.credits).toBe(7)
    expect(applyRewardPoolRefund({ credits: CAP, updatedAt: T0 }, CAP, T0, 9).snapshot.credits).toBe(CAP)
  })

  it('stops the refill clock once the refund fills the pool', () => {
    const now = T0 + rewardPoolRegenMs() / 2
    const refunded = applyRewardPoolRefund({ credits: CAP - 1, updatedAt: T0 }, CAP, now, 1)
    expect(refunded.snapshot).toEqual({ credits: CAP, updatedAt: now })
    expect(refunded.state.nextAt).toBeNull()
  })

  it('keeps the pending minutes when the refund leaves the pool short of full', () => {
    const now = T0 + rewardPoolRegenMs() / 2
    const refunded = applyRewardPoolRefund({ credits: 2, updatedAt: T0 }, CAP, now, 1)
    expect(refunded.snapshot).toEqual({ credits: 3, updatedAt: T0 })
    expect(refunded.state.nextAt).toBe(T0 + rewardPoolRegenMs())
  })

  it('never reports a refund as a payment', () => {
    expect(applyRewardPoolRefund({ credits: 4, updatedAt: T0 }, CAP, T0, 3).paid).toBe(0)
  })
})

describe('reward pool daily estimate', () => {
  it('derives the 24-hour refill from the configured interval and step', () => {
    expect(rewardPoolCreditsPerDay()).toBe(30)
    expect(rewardPoolCreditsPerDay()).toBe((1_440 * 60_000) / rewardPoolRegenMs())
  })
})
