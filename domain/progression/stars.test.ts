import { describe, expect, it } from 'vitest'
import { getMaxReward, getStarReward, getStars } from './stars'

describe('reward invariants', () => {
  it('uses server-side duration boundaries consistently', () => {
    expect(getStars(10_000, 'Easy')).toBe(3)
    expect(getStars(10_001, 'Easy')).toBe(2)
    expect(getStars(20_001, 'Easy')).toBe(1)
  })

  it.each(['Easy', 'Medium', 'Hard'] as const)('%s maximum equals its three-star reward', (difficulty) => {
    expect(getMaxReward(difficulty)).toBe(getStarReward(difficulty, 3))
  })

  it('caps the highest possible task reward at nine credits', () => {
    expect(getMaxReward('Hard')).toBe(9)
  })
})
