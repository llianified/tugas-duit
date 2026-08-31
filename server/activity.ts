import { query } from './db'

export type ActivityKind = 'perfect' | 'payout'

export interface ActivityEntry {
  id: string
  kind: ActivityKind
  displayName: string
  photoUrl: string | null
  /** Credit untuk 'perfect', rupiah untuk 'payout'. */
  amount: number
  difficulty: string | null
  at: number
}

const FEED_LIMIT = 40

/**
 * Maksimum baris task per orang dalam satu jendela umpan. Tiga cukup agar penggiling
 * aktif terlihat aktif tanpa memborong empat puluh baris — pada 40 baris itu berarti
 * paling tidak empat belas orang berbeda selalu terwakili.
 */
const USER_STREAK_CAP = 3

/**
 * Umpan aktivitas publik, global untuk semua user dan urut waktu. Dua sumber, dan
 * keduanya dipilih karena sudah publik di tempat lain: task bintang tiga memakai nama
 * depan Telegram persis seperti papan peringkat, dan penarikan yang sudah dibayar
 * memakai baris yang sama dengan tab "Bukti bayar". Tidak ada permukaan privasi baru
 * yang dibuka di sini.
 *
 * Yang TIDAK masuk umpan: task bintang satu dan dua. Umpan ini gunanya menunjukkan
 * apa yang mungkin, bukan mencatat semua yang terjadi — dan pada volume produksi
 * bintang satu akan menenggelamkan sisanya dalam hitungan detik.
 *
 * Sebelumnya baris task dibatasi `distinct on (tc.user_id)` — satu baris per orang —
 * untuk mencegah satu penggiling cepat mengisi seluruh umpan dengan namanya sendiri.
 * Tapi batas itu juga yang membuat umpannya tidak bisa hidup: begitu tiap orang sudah
 * punya satu baris, task berikutnya cuma menggeser baris yang sudah ada, jadi polling
 * berapa cepat pun tetap terlihat diam. Karena umpan ini sekarang menyegarkan sendiri,
 * urutan waktu murni yang dipakai, dan dominasi satu nama ditahan `USER_STREAK_CAP`
 * lewat `row_number()` di bawah — batasnya per jendela umpan, bukan satu baris mati.
 *
 * Nominal penarikan dibaca dari `withdrawals.amount_idr`, bukan dihitung ulang dari
 * credit: kurs dibekukan saat pengajuan, dan menghitung ulang akan menampilkan angka
 * yang berbeda dari yang benar-benar dibayarkan.
 */
export async function getActivityFeed(): Promise<ActivityEntry[]> {
  const rows = await query<{
    id: string
    kind: ActivityKind
    display_name: string
    photo_url: string | null
    amount: number
    difficulty: string | null
    at: Date
  }>(
    `(select id, kind, display_name, photo_url, amount, difficulty, at
        from (select 'tc-' || tc.id      as id,
                     'perfect'           as kind,
                     u.first_name        as display_name,
                     u.photo_url         as photo_url,
                     tc.reward::int      as amount,
                     tc.difficulty::text as difficulty,
                     tc.completed_at     as at,
                     row_number() over (
                       partition by tc.user_id order by tc.completed_at desc
                     )                   as per_user
                from task_completions tc
                join users u on u.id = tc.user_id
               where u.banned_at is null and tc.stars = 3
               order by tc.completed_at desc
               limit $1 * $2) recent
       where per_user <= $2)
     union all
     (select 'wd-' || w.id, 'payout', u.first_name, u.photo_url,
             w.amount_idr::int, null, w.paid_at
        from withdrawals w
        join users u on u.id = w.user_id
       where u.banned_at is null and w.state = 'paid' and w.paid_at is not null
       order by w.paid_at desc
       limit $1)
     order by at desc
     limit $1`,
    [FEED_LIMIT, USER_STREAK_CAP],
  )

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    displayName: row.display_name || 'Pengguna',
    photoUrl: row.photo_url,
    amount: Number(row.amount),
    difficulty: row.difficulty,
    at: row.at.getTime(),
  }))
}
