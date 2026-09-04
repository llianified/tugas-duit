import { rankMinTasks } from '../economy/economy-config'

export interface Rank {
  tier: number
  name: string
  minTasks: number
}

const RANK_NAMES: readonly { tier: number; name: string }[] = [
  { tier: 1, name: 'Apprentice' },
  { tier: 2, name: 'Artisan' },
  { tier: 3, name: 'Expert' },
  { tier: 4, name: 'Virtuoso' },
  { tier: 5, name: 'Luminary' },
]

function ranks(): Rank[] {
  return RANK_NAMES.map((rank) => ({ ...rank, minTasks: rankMinTasks(rank.tier) }))
}

export function getRank(completedCount: number): Rank {
  const list = ranks()
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (completedCount >= list[index].minTasks) return list[index]
  }
  return list[0]
}

export interface Progression {
  rank: Rank
  nextRank: Rank | null
  tasksToNextRank: number
  rankProgress: number
  rankSpan: number
  streak: number
  streakSecured: boolean
}

interface ProgressionInput {
  completedCount: number
  streak: number
  todayCount: number
}

export function getProgression({
  completedCount,
  streak,
  todayCount,
}: ProgressionInput): Progression {
  const completed = completedCount
  const rank = getRank(completed)
  const nextRank: Rank | null =
    ranks().find((candidate) => candidate.tier === rank.tier + 1) ?? null

  const rankSpan = nextRank === null ? 0 : nextRank.minTasks - rank.minTasks

  return {
    rank,
    nextRank,
    tasksToNextRank: nextRank === null ? 0 : nextRank.minTasks - completed,
    rankProgress: nextRank === null ? 0 : completed - rank.minTasks,
    rankSpan,
    streak,
    streakSecured: todayCount > 0,
  }
}
