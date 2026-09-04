
import type { LeaderboardBoard, LeaderboardEntry } from '@/domain/progression/leaderboard'
import { FOUNDER_MAX_USER_ID } from '@/domain/progression/prestige'
import { query } from '../platform/db'

/** 500, naik dari 20. Papan sepanjang ini tidak dimaksudkan untuk digulir habis — UI-nya memuat 50 baris sekaligus dan menyematkan posisi user di atas — melainkan supaya peringkat masih berarti bagi orang yang tidak akan pernah masuk sepuluh besar. Muatannya tetap kecil: 500 baris berisi angka dan nama pendek, dan querinya sudah memindai seluruh peserta untuk menghitung `participants` sejak sebelum perubahan ini. */
const BOARD_SIZE = 500

export async function getLeaderboard(userId: number): Promise<LeaderboardBoard> {
  const rows = await query<{
    public_id: string
    first_name: string
    photo_url: string | null
    position: number
    task_count: number
    task_credits: number
    participants: number
    premium_members: number
    is_you: boolean
    is_premium: boolean
    is_founder: boolean
  }>(
    `with ranked as (
       select u.id,
              u.public_id,
              u.first_name,
              u.photo_url,
              count(tc.id)::int                                  as task_count,
              coalesce(sum(tc.reward), 0)::int                    as task_credits,
              (rank() over (order by coalesce(sum(tc.reward), 0) desc,
                                     count(tc.id) desc,
                                     u.id))::int                  as position,
              (count(*) over ())::int                             as participants,
              (u.premium_until is not null and u.premium_until > now()) as is_premium,
              (u.id <= $3) as is_founder,
              (count(*) filter (
                 where u.premium_until is not null and u.premium_until > now()
               ) over ())::int                                    as premium_members
         from users u
         join task_completions tc on tc.user_id = u.id
        where u.banned_at is null
        group by u.id
     )
     select public_id, first_name, photo_url, task_count, task_credits, position, participants,
            premium_members, is_premium, is_founder,
            (id = $1) as is_you
       from ranked
      where position <= $2 or id = $1
      order by position`,
    [userId, BOARD_SIZE, FOUNDER_MAX_USER_ID],
  )

  const toEntry = (row: (typeof rows)[number]): LeaderboardEntry => ({
    id: row.public_id,
    displayName: row.first_name || 'Pengguna',
    photoUrl: row.photo_url,
    position: row.position,
    taskCount: row.task_count,
    credits: row.task_credits,
    you: row.is_you,
    premium: row.is_premium,
    founder: row.is_founder,
  })

  return {
    entries: rows.filter((row) => row.position <= BOARD_SIZE).map(toEntry),
    you: rows.filter((row) => row.is_you).map(toEntry)[0] ?? null,
    participants: rows[0]?.participants ?? 0,
    premiumMembers: rows[0]?.premium_members ?? 0,
  }
}
