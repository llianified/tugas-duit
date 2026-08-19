import { describe, expect, it } from 'vitest'
import { commissionUnitsForReward, splitUnitsIntoCredits, unitsToCredits } from './domain'

describe('referral commission invariants', () => {
  it('keeps commission arithmetic in integer units', () => {
    expect(commissionUnitsForReward(1)).toBe(10)
    expect(commissionUnitsForReward(6)).toBe(60)
    expect(commissionUnitsForReward(9)).toBe(90)
  })

  it('settles a balance crossing one credit without violating the remainder range', () => {
    expect(splitUnitsIntoCredits(110)).toEqual({ credits: 1, remainderUnits: 10 })
  })

  it.each([0, 99, 100, 199, 1_250])('keeps remainder for %i in the database range', (units) => {
    const result = splitUnitsIntoCredits(units)
    expect(result.remainderUnits).toBeGreaterThanOrEqual(0)
    expect(result.remainderUnits).toBeLessThan(100)
    expect(result.credits + unitsToCredits(result.remainderUnits)).toBe(unitsToCredits(units))
  })
})
