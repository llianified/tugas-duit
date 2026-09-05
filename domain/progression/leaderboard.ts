import { economyConfig } from '../economy/economy-config'

export interface LeaderboardEntry {
  id: string
  displayName: string
  position: number
  taskCount: number
  credits: number
  you: boolean
  /** Terlihat oleh SEMUA orang, bukan cuma pemiliknya — ini satu-satunya permukaan publik status premium. */
  premium: boolean
  /** Foto profil Telegram. `null` kalau user menyembunyikannya atau belum pernah punya. */
  photoUrl: string | null
  /** Termasuk akun paling awal. Tidak bisa dikejar siapa pun lagi, dan itulah gunanya. */
  founder: boolean
}

export interface LeaderboardBoard {
  entries: LeaderboardEntry[]
  you: LeaderboardEntry | null
  /** Awal dan akhir musim berjalan. `null` berarti papannya menghitung sepanjang masa
   * (`leaderboardSeasonDays` disetel 0). Dikirim supaya UI bisa menampilkan sisa waktunya — itu
   * yang membuat musim jadi alasan untuk kembali, bukan sekadar reset yang tiba-tiba. */
  seasonStartedAt: number | null
  seasonEndsAt: number | null
  participants: number
  /** Berapa peserta papan yang premium. Dipakai untuk menunjukkan kelangkaannya, bukan untuk peringkat. */
  premiumMembers: number
}

/** Anchor musim: sebuah hari Senin, dipakai sebagai titik nol supaya musim sepanjang berapa pun
 * hari selalu berganti di batas yang sama untuk semua orang. Tidak disimpan di database karena
 * musimnya diturunkan dari tanggal — sama seperti undian misi harian. */
export const SEASON_ANCHOR = '2026-01-05'

export function leaderboardSeasonDays(): number {
  return Math.max(0, Math.floor(economyConfig().leaderboardSeasonDays))
}
