export type ActivityKind = 'perfect' | 'payout'

export interface ActivityEntry {
  id: string
  kind: ActivityKind
  displayName: string
  photoUrl: string | null
  amount: number
  difficulty: string | null
  at: number
}
