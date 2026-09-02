
import { CHALLENGE_TITLE, type Difficulty, type HistoryEntry } from '@/features/captcha/domain'
import type { StarCount } from '@/domain/stars'
import { query } from './db'

const PAGE_SIZE = 30

export interface HistoryCursor {
  /** ISO UTC ber-mikrodetik, apa adanya dari Postgres. */
  completedAt: string
  id: string
}

const CURSOR_TIME_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/

/** Cursor menyimpan waktunya sebagai teks ber-mikrodetik, bukan milidetik. `pg` mengembalikan `timestamptz` sebagai `Date`, yang cuma bermilidetik, sedangkan `now()` menulis mikrodetik. Cursor berbasis `getTime()` karena itu dibulatkan ke bawah, dan perbandingan `(completed_at, id) < ($2, $3)` ikut menggeser batasnya: baris yang jatuh di dalam milidetik yang sama tapi sub-milidetik lebih awal — dengan id lebih besar — tidak pernah muncul di halaman berikutnya. Riwayat task-nya hilang diam-diam, dan tidak ada yang bisa melihatnya kecuali dua task selesai dalam milidetik yang sama. Waktunya dibaca ulang dari database sebagai teks supaya tidak pernah melewati `Date`, dan dikirim balik sebagai `timestamptz` sehingga `task_completions_user_completed_idx` tetap terpakai. Id ditaruh di depan karena ISO-nya sendiri mengandung titik dua. */
export function parseHistoryCursor(raw: string | null): HistoryCursor | null {
  if (!raw) return null
  const separator = raw.indexOf(':')
  if (separator <= 0) return null
  const id = raw.slice(0, separator)
  const completedAt = raw.slice(separator + 1)
  if (!/^\d+$/.test(id) || !CURSOR_TIME_SHAPE.test(completedAt)) return null
  return { completedAt, id }
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
    completed_cursor: string
  }>(
    `select id, type, difficulty, reward, stars, completed_at,
            to_char(completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
              as completed_cursor
       from task_completions
      where user_id = $1
        and (
          $2::text is null
          or (completed_at, id) < ($2::timestamptz, $3::bigint)
        )
      order by completed_at desc, id desc
      limit $4`,
    [userId, cursor?.completedAt ?? null, cursor?.id ?? null, PAGE_SIZE + 1],
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
      ? `${page[page.length - 1].id}:${page[page.length - 1].completed_cursor}`
      : null,
  }
}
