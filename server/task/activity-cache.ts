import { type ActivityEntry, getActivityFeed } from './activity'

/** Di bawah `ACTIVITY_POLL_MS` (30 detik) di `shell/use-session-queries.ts`, jadi tiap polling praktis selalu menemukan cache yang sudah kedaluwarsa dan umpannya tetap terlihat hidup. Staleness maksimum yang dijanjikan ke pemakai: 20 detik. */
const FEED_TTL_MS = 20_000

/** Kalau query gagal sementara — Neon baru bangun, koneksi lepas — data lama yang belum terlalu tua lebih baik daripada 500 di umpan hiasan. Tapi ada batasnya: lebih tua dari ini errornya dilempar, karena cache tidak boleh berubah jadi sumber data yang salah tanpa batas waktu. */
const STALE_GRACE_MS = 120_000

let cached: { entries: ActivityEntry[]; at: number } | null = null
let inflight: Promise<ActivityEntry[]> | null = null

/**
 * `getActivityFeed()` tidak menerima parameter user: hasilnya identik untuk semua orang,
 * tapi dulu dijalankan sekali per request. Dengan polling 30 detik, 100 user yang membuka
 * tab Peringkat berarti ~100 kali `union all` + `row_number()` atas `task_completions` dan
 * `withdrawals` setiap 30 detik — beban yang seluruhnya menghitung jawaban yang sama.
 *
 * Yang boleh masuk pola ini hanya payload publik global. Jangan ditiru untuk endpoint yang
 * jawabannya bergantung `user.id` (`/api/leaderboard` memanggil `getLeaderboard(user.id)`):
 * cache satu slot untuk jawaban per-user adalah kebocoran data antar-user.
 *
 * `inflight` menahan badai cache-miss: request yang datang bersamaan menunggu satu query
 * yang sama, bukan menembakkan seratus.
 */
export async function getCachedActivityFeed(): Promise<ActivityEntry[]> {
  const now = Date.now()
  if (cached && now - cached.at < FEED_TTL_MS) return cached.entries
  if (inflight) return inflight

  const run = (async () => {
    try {
      const entries = await getActivityFeed()
      cached = { entries, at: Date.now() }
      return entries
    } catch (error) {
      if (cached && Date.now() - cached.at < STALE_GRACE_MS) {
        console.warn('[activity] umpan gagal dimuat, menyajikan salinan lama:', error)
        return cached.entries
      }
      throw error
    } finally {
      inflight = null
    }
  })()

  inflight = run
  return run
}

/** Hanya untuk uji. Invalidasi berbasis event sengaja tidak disediakan: cache ini per instance, jadi invalidasi hanya mengenai satu instance dan memberi rasa aman yang salah. TTL 20 detik adalah batas staleness yang sebenarnya. */
export function invalidateActivityFeedCache(): void {
  cached = null
  inflight = null
}
