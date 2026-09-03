import type { ArcadeGame, ArcadePrize, ArcadePrizeEntry, ArcadeRefusal } from '@/domain/arcade/arcade'

/** Bentuk balasan `/api/arcade`, dikembarkan dengan `ArcadeState` di `server/arcade/arcade.ts`. Ditulis ulang di sini alih-alih diimpor supaya klien tidak menyeret modul server — dan dengan begitu `pg` — ke dalam bundle. Pola yang sama dipakai `shell/session-api.ts` terhadap payload sesi. */
export interface ArcadeStateResponse {
  enabled: boolean
  adGated: boolean
  playsLeft: number
  cooldownSecondsLeft: number
  cooldownUntil: number | null
  hasAdPass: boolean
  matchSeconds: number
  boxCount: number
  matchPairs: number
  prizes: ArcadePrizeEntry[]
  winnable: ArcadePrizeEntry[]
  openPlay: { id: string; game: ArcadeGame; expiresAt: number } | null
  refusal: ArcadeRefusal | null
  now: number
}

export interface ArcadeOpenResponse {
  ok: true
  play: { id: string; game: ArcadeGame; expiresAt: number }
  matchSeconds: number
}

export interface ArcadeSettleResponse {
  ok: true
  prize: ArcadePrize
  boxes: ArcadePrize[] | null
  energy: number | null
  energyMax: number | null
  poolCurrent: number | null
  poolMax: number | null
}
