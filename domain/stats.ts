
import { getProgression, type Progression } from '@/domain/progression'
import { DIFFICULTY_LABEL, type Difficulty } from '@/domain/challenge'

const DIFFICULTY_ORDER: readonly Difficulty[] = ['Easy', 'Medium', 'Hard']

interface DifficultyStat {
  difficulty: Difficulty
  label: string
  count: number
  credits: number
  share: number
}

/** Satu titik per hari WIB: berapa credit yang masuk dari task hari itu. */
export interface EarningsPoint {
  day: string
  credits: number
}

export interface UserStats {
  joinedAt: number | null
  earningsSeries: EarningsPoint[]
  earnedCredits: number
  taskCredits: number
  referralCredits: number
  withdrawnCredits: number
  processingCredits: number
  balance: number

  progression: Progression
  streak: number
  activeDays: number

  completedCount: number
  todayCount: number
  totalStars: number
  averageStars: number
  perfectCount: number
  perfectShare: number
  averageReward: number
  bestReward: number
  firstCompletedAt: number | null
  lastCompletedAt: number | null
  byDifficulty: DifficultyStat[]

  referralCount: number
  activeReferralCount: number
  downlineTasks: number

  payoutCount: number
  paidPayoutCount: number
  processingPayoutCount: number
}

export interface DifficultyTally {
  count: number
  credits: number
}

interface StatsInput {
  joinedAt: number | null
  earningsSeries: EarningsPoint[]
  completedCount: number
  todayCount: number
  totalStars: number
  perfectCount: number
  bestReward: number
  firstCompletedAt: number | null
  lastCompletedAt: number | null
  activeDays: number
  streak: number
  byDifficulty: Readonly<Record<Difficulty, DifficultyTally>>

  taskCredits: number
  referralCredits: number
  withdrawnCredits: number
  processingCredits: number
  balance: number

  referralCount: number
  activeReferralCount: number
  downlineTasks: number
  payoutCount: number
  paidPayoutCount: number
  processingPayoutCount: number
}

export function getUserStats({
  joinedAt,
  earningsSeries,
  completedCount,
  todayCount,
  totalStars,
  perfectCount,
  bestReward,
  firstCompletedAt,
  lastCompletedAt,
  activeDays,
  streak,
  byDifficulty,
  taskCredits,
  referralCredits,
  withdrawnCredits,
  processingCredits,
  balance,
  referralCount,
  activeReferralCount,
  downlineTasks,
  payoutCount,
  paidPayoutCount,
  processingPayoutCount,
}: StatsInput): UserStats {
  const progression = getProgression({ completedCount, streak, todayCount })

  return {
    joinedAt,
    earningsSeries,
    earnedCredits: taskCredits + referralCredits,
    taskCredits,
    referralCredits,
    withdrawnCredits,
    processingCredits,
    balance,

    progression,
    streak: progression.streak,
    activeDays,

    completedCount,
    todayCount,
    totalStars,
    averageStars: completedCount === 0 ? 0 : totalStars / completedCount,
    perfectCount,
    perfectShare: completedCount === 0 ? 0 : perfectCount / completedCount,
    averageReward: completedCount === 0 ? 0 : taskCredits / completedCount,
    bestReward,
    firstCompletedAt,
    lastCompletedAt,
    byDifficulty: DIFFICULTY_ORDER.map((difficulty) => {
      const tally = byDifficulty[difficulty]
      return {
        difficulty,
        label: DIFFICULTY_LABEL[difficulty],
        count: tally.count,
        credits: tally.credits,
        share: completedCount === 0 ? 0 : tally.count / completedCount,
      }
    }),

    referralCount,
    activeReferralCount,
    downlineTasks,

    payoutCount,
    paidPayoutCount,
    processingPayoutCount,
  }
}
