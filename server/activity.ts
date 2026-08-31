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
 * Umpan aktivitas publik. Dua sumber, dan keduanya dipilih karena sudah publik di
 * tempat lain: task bintang tiga memakai nama depan Telegram persis seperti papan
 * peringkat, dan penarikan yang sudah dibayar memakai baris yang sama dengan tab
 * "Bukti bayar". Tidak ada permukaan privasi baru yang dibuka di sini.
 *
 * Yang TIDAK masuk umpan: task bintang satu dan dua. Umpan ini gunanya menunjukkan
 * apa yang mungkin, bukan mencatat semua yang terjadi — dan pada volume produksi
 * bintang satu akan menenggelamkan sisanya dalam hitungan detik.
 *
 * `distinct on (tc.user_id)` membatasi satu baris task per orang, dan itu bukan
 * penghematan melainkan syarat agar umpannya berguna: tanpa itu satu penggiling cepat
 * mengisi seluruh empat puluh baris dengan namanya sendiri, dan umpan yang isinya satu
 * nama tidak memberi tahu apa pun tentang orang lain. Terlihat langsung saat data uji
 * pertama kali dirender.
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
    `(select distinct on (tc.user_id)
             'tc-' || tc.id            as id,
             'perfect'                 as kind,
             u.first_name              as display_name,
             u.photo_url               as photo_url,
             tc.reward::int            as amount,
             tc.difficulty::text       as difficulty,
             tc.completed_at           as at
        from task_completions tc
        join users u on u.id = tc.user_id
       where u.banned_at is null and tc.stars = 3
       order by tc.user_id, tc.completed_at desc
       limit $1)
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
    [FEED_LIMIT],
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
