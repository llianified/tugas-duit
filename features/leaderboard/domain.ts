
export interface LeaderboardEntry {
  id: string
  displayName: string
  position: number
  taskCount: number
  credits: number
  you: boolean
  /** Terlihat oleh SEMUA orang, bukan cuma pemiliknya — ini satu-satunya permukaan publik status premium. */
  premium: boolean
}

export interface LeaderboardBoard {
  entries: LeaderboardEntry[]
  you: LeaderboardEntry | null
  participants: number
  /** Berapa peserta papan yang premium. Dipakai untuk menunjukkan kelangkaannya, bukan untuk peringkat. */
  premiumMembers: number
}
