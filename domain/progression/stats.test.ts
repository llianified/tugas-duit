import { describe, expect, it } from 'vitest'
import { getUserStats } from './stats'

const baseInput = {
  joinedAt: null,
  earningsSeries: [],
  completedCount: 0,
  todayCount: 0,
  totalStars: 0,
  perfectCount: 0,
  bestReward: 0,
  firstCompletedAt: null,
  lastCompletedAt: null,
  activeDays: 0,
  streak: 0,
  byDifficulty: {
    Easy: { count: 0, credits: 0 },
    Medium: { count: 0, credits: 0 },
    Hard: { count: 0, credits: 0 },
  },
  taskCredits: 0,
  referralCredits: 0,
  withdrawnCredits: 0,
  processingCredits: 0,
  balance: 0,
  referralCount: 0,
  activeReferralCount: 0,
  downlineTasks: 0,
  payoutCount: 0,
  paidPayoutCount: 0,
  processingPayoutCount: 0,
}

describe('user stats', () => {
  it('tidak menghasilkan pembagian nol untuk akun baru', () => {
    const stats = getUserStats(baseInput)

    expect(stats.averageStars).toBe(0)
    expect(stats.perfectShare).toBe(0)
    expect(stats.averageReward).toBe(0)
  })

  it('menggabungkan penghasilan dan menjaga urutan kesulitan', () => {
    const stats = getUserStats({
      ...baseInput,
      completedCount: 4,
      totalStars: 10,
      perfectCount: 2,
      taskCredits: 20,
      referralCredits: 3,
      byDifficulty: {
        Easy: { count: 1, credits: 2 },
        Medium: { count: 2, credits: 9 },
        Hard: { count: 1, credits: 9 },
      },
    })

    expect(stats.earnedCredits).toBe(23)
    expect(stats.averageStars).toBe(2.5)
    expect(stats.perfectShare).toBe(0.5)
    expect(stats.byDifficulty.map((entry) => entry.difficulty)).toEqual(['Easy', 'Medium', 'Hard'])
    expect(stats.byDifficulty[1].share).toBe(0.5)
  })
})
