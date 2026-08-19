
export interface LeaderboardEntry {
  id: string
  displayName: string
  position: number
  taskCount: number
  credits: number
  you: boolean
}

export interface LeaderboardBoard {
  entries: LeaderboardEntry[]
  you: LeaderboardEntry | null
  participants: number
}
