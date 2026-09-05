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

/** Jarak ke tetangga peringkat. `chase` menatap ke atas, `lead` ke bawah saat sudah di puncak. */
export interface LeaderboardGap {
  kind: 'chase' | 'lead'
  /** Selisih TD-nya. Boleh 0 — dua orang bisa seri, dan penyaji yang memilih kata untuk itu. */
  credits: number
  displayName: string
}

/** Selisih TD antara user dan tetangga peringkatnya, atau `null` kalau tidak ada yang bisa
 * dibandingkan.
 *
 * Papan peringkat hidup dari SELISIH, bukan dari peringkat. "#2 dari 19" adalah status: ia
 * menyatakan posisi lalu berhenti di situ. "10 TD lagi" adalah ajakan — dan angkanya sudah ada di
 * data yang sama, cuma tidak pernah dihitung.
 *
 * Tinggal di `domain/` karena ia aturan, bukan penyajian: yang di puncak dibandingkan ke bawah,
 * sisanya ke atas, dan keduanya harus bisa diuji tanpa merender papan. */
export function leaderboardGap(
  entries: readonly LeaderboardEntry[],
  you: LeaderboardEntry | null,
): LeaderboardGap | null {
  if (!you) return null

  /** Yang di puncak tidak punya siapa pun di atasnya, jadi yang ditunjukkan keunggulannya. Tanpa
   * cabang ini juara membaca kartu tanpa satu angka pun yang bergerak — keadaan yang justru paling
   * ingin ia jaga. */
  const neighbourPosition = you.position === 1 ? 2 : you.position - 1
  const neighbour = entries.find((entry) => entry.position === neighbourPosition)
  if (!neighbour) return null

  return you.position === 1
    ? { kind: 'lead', credits: you.credits - neighbour.credits, displayName: neighbour.displayName }
    : { kind: 'chase', credits: neighbour.credits - you.credits, displayName: neighbour.displayName }
}
