
import { CHALLENGE_TITLE, type Difficulty, type HistoryEntry } from '@/features/captcha/domain'
import type { StarCount } from '@/domain/stars'
import { query } from './db'

const PAGE_SIZE = 30

export interface HistoryCursor {
  completedAt: number
  id: string
}

interface HistoryPage {
  entries: HistoryEntry[]
  nextCursor: string | null
}

export async function getHistoryPage(
  userId: number,
  cursor: HistoryCursor | null,
): Promise<HistoryPage> {
  const rows = await query<{
    id: string
    type: keyof typeof CHALLENGE_TITLE
    difficulty: Difficulty
    reward: number
    stars: number
    completed_at: Date
  }>(
    `select id, type, difficulty, reward, stars, completed_at
       from task_completions
      where user_id = $1
        and (
          $2::timestamptz is null
          or (completed_at, id) < ($2::timestamptz, $3::bigint)
        )
      order by completed_at desc, id desc
      limit $4`,
    [
      userId,
      cursor ? new Date(cursor.completedAt) : null,
      cursor?.id ?? null,
      PAGE_SIZE + 1,
    ],
  )

  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  return {
    entries: page.map((row) => ({
      id: row.id,
      title: CHALLENGE_TITLE[row.type],
      difficulty: row.difficulty,
      reward: row.reward,
      stars: row.stars as StarCount,
      completedAt: row.completed_at.getTime(),
    })),
    nextCursor: hasMore
      ? `${page[page.length - 1].completed_at.getTime()}:${page[page.length - 1].id}`
      : null,
  }
}
