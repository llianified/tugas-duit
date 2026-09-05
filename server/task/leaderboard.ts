
import {
  SEASON_ANCHOR,
  leaderboardSeasonDays,
  type LeaderboardBoard,
  type LeaderboardEntry,
} from '@/domain/progression/leaderboard'
import { FOUNDER_MAX_USER_ID } from '@/domain/progression/prestige'
import { query } from '../platform/db'

/** 500, naik dari 20. Papan sepanjang ini tidak dimaksudkan untuk digulir habis — UI-nya memuat 50 baris sekaligus dan menyematkan posisi user di atas — melainkan supaya peringkat masih berarti bagi orang yang tidak akan pernah masuk sepuluh besar. Muatannya tetap kecil: 500 baris berisi angka dan nama pendek, dan querinya sudah memindai seluruh peserta untuk menghitung `participants` sejak sebelum perubahan ini. */
const BOARD_SIZE = 500

/** Potret papan yang dipakai bersama seluruh pemirsa selama 60 detik, mengikuti pola cache
 * `loadEconomyConfig`. Kueri di baliknya adalah yang termahal di aplikasi — ia menggabungkan
 * setiap user tidak-terbanned dengan setiap barisnya di `task_completions` di dalam musim berjalan,
 * lalu mengurutkan seluruh hasilnya — dan tidak ada indeks yang bisa menghindarinya: peringkat
 * yang tepat memang menuntut membaca semuanya. Yang bisa dihindari adalah menjalankannya ulang
 * untuk permintaan yang jawabannya sama. Papan, jumlah peserta, dan jumlah premium identik untuk
 * semua orang, jadi ketiganya dipotret sekali; hanya baris "kamu" yang milik masing-masing, dan
 * itu dihafal per pemirsa selama umur potret yang sama. Papan peringkat tidak perlu real-time —
 * yang tidak boleh adalah satu pemirsa melihat baris pemirsa lain, dan itulah yang dijaga
 * `viewers`. */
const SNAPSHOT_TTL_MS = 60_000

/** Batas hafalan, bukan batas pemirsa: yang ke-501 tetap dilayani, hanya saja lewat kueri lagi.
 * Tanpa batas ini satu putaran trafik ramai menahan seluruh daftar pemirsa di memori lambda. */
const MAX_MEMOIZED_VIEWERS = 500

interface Snapshot {
  at: number
  entries: LeaderboardEntry[]
  participants: number
  premiumMembers: number
  /** Potret milik satu musim. Dipakai ulang hanya selama musimnya belum berganti — tanpa ini,
   * papan musim lama masih tersaji sampai satu menit setelah musim baru dimulai, tepat di momen
   * yang paling diperhatikan orang. */
  seasonStartedAt: number | null
  seasonEndsAt: number | null
  viewers: Map<number, LeaderboardEntry | null>
}

/** Awal musim berjalan, dihitung Postgres dengan alasan yang sama seperti undian misi harian:
 * `completed_at` dibandingkan dengan batas ini, jadi keduanya harus datang dari jam yang sama.
 * Anchor hari Senin membuat musim sepanjang berapa pun hari selalu berganti di batas yang sama
 * untuk semua orang, bukan bergeser mengikuti kapan fiturnya dinyalakan. */
const seasonBoundsSql = (days: string, anchor: string) => `
  select started_at,
         case when started_at is null then null
              else started_at + (${days}::int * interval '1 day') end as ends_at
    from (
      select case when ${days}::int <= 0 then null else (
        (${anchor}::date + (floor(
           (((now() at time zone 'Asia/Jakarta')::date - ${anchor}::date))::numeric / ${days}::int
         ) * ${days}::int)::int)
          at time zone 'Asia/Jakarta'
      ) end as started_at
    ) as season`

let snapshot: Snapshot | null = null

function remember(viewers: Map<number, LeaderboardEntry | null>, userId: number, you: LeaderboardEntry | null) {
  if (viewers.size >= MAX_MEMOIZED_VIEWERS) {
    const oldest = viewers.keys().next()
    if (!oldest.done) viewers.delete(oldest.value)
  }
  viewers.set(userId, you)
}

function boardOf(snap: Snapshot, you: LeaderboardEntry | null): LeaderboardBoard {
  return {
    // `you` dipasang saat menyajikan, bukan saat memotret: potretnya dipakai bersama.
    entries: you
      ? snap.entries.map((entry) => (entry.id === you.id ? { ...entry, you: true } : entry))
      : snap.entries,
    you,
    participants: snap.participants,
    premiumMembers: snap.premiumMembers,
    seasonStartedAt: snap.seasonStartedAt,
    seasonEndsAt: snap.seasonEndsAt,
  }
}

export async function getLeaderboard(userId: number): Promise<LeaderboardBoard> {
  const seasonDays = leaderboardSeasonDays()
  const fresh = snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL_MS ? snapshot : null
  if (fresh?.viewers.has(userId)) return boardOf(fresh, fresh.viewers.get(userId) ?? null)

  /** Dibaca terpisah, bukan ikut menumpang baris papan: tepat setelah musim berganti papannya
   * masih kosong, dan justru di momen itulah sisa waktu musim paling perlu terbaca. Kuerinya
   * ekspresi konstan tanpa memindai tabel, jadi ongkosnya tidak berarti. */
  const [boundsRows, rows] = await Promise.all([
    query<{ started_at: Date | null; ends_at: Date | null }>(seasonBoundsSql('$1', '$2'), [
      seasonDays,
      SEASON_ANCHOR,
    ]),
    query<{
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
    /** Batas musimnya dihitung Postgres, bukan proses ini, dengan alasan yang sama seperti undian
        misi: `completed_at` dibandingkan dengan batas itu, jadi keduanya harus datang dari jam yang
        sama. Anchor hari Senin membuat musim sepanjang berapa pun hari selalu berganti di batas
        yang sama untuk semua orang. */
    `with bounds as (${seasonBoundsSql('$4', '$5')}),
     ranked as (
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
         cross join bounds b
         join task_completions tc
           on tc.user_id = u.id
          and (b.started_at is null or tc.completed_at >= b.started_at)
        where u.banned_at is null
        group by u.id
     )
     select public_id, first_name, photo_url, task_count, task_credits, position, participants,
            premium_members, is_premium, is_founder,
            (id = $1) as is_you
       from ranked
      where position <= $2 or id = $1
      order by position`,
      [userId, BOARD_SIZE, FOUNDER_MAX_USER_ID, seasonDays, SEASON_ANCHOR],
    ),
  ])

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

  const you = rows.filter((row) => row.is_you).map(toEntry)[0] ?? null

  /** Potret lama dipakai lagi hanya selama ia masih sepakat soal siapa yang ada di papan. Tanpa
   * syarat ini user yang baru saja naik ke 500 besar tidak melihat dirinya di mana pun sampai
   * potretnya kedaluwarsa: `you.position` sudah di dalam papan, jadi UI tidak menyematkannya di
   * atas, sementara barisnya belum ada di daftar. */
  const seasonStartedAt = boundsRows[0]?.started_at?.getTime() ?? null
  const seasonEndsAt = boundsRows[0]?.ends_at?.getTime() ?? null

  if (
    fresh &&
    fresh.seasonStartedAt === seasonStartedAt &&
    (!you || you.position > BOARD_SIZE || fresh.entries.some((e) => e.id === you.id))
  ) {
    remember(fresh.viewers, userId, you)
    return boardOf(fresh, you)
  }

  snapshot = {
    at: Date.now(),
    entries: rows
      .filter((row) => row.position <= BOARD_SIZE)
      .map((row) => ({ ...toEntry(row), you: false })),
    participants: rows[0]?.participants ?? 0,
    premiumMembers: rows[0]?.premium_members ?? 0,
    seasonStartedAt,
    seasonEndsAt,
    viewers: new Map([[userId, you]]),
  }
  return boardOf(snapshot, you)
}
