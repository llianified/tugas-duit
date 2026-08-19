import { economyConfig } from './economy-config'

export function adsMaxViewsPerDay(): number {
  return economyConfig().adsMaxViewsPerDay
}

export function adsCooldownMs(): number {
  return economyConfig().adsCooldownSeconds * 1000
}

export function adsConfigured(): boolean {
  return adsMaxViewsPerDay() > 0
}

export interface AdOpenState {
  viewsToday: number
  lastOpenedAt: number | null
  hasPending: boolean
  hasReady: boolean
}

export type AdRefusal =
  | 'ads_disabled'
  | 'daily_limit'
  | 'cooling_down'
  | 'ticket_open'
  | 'pass_ready'

export function adViewsLeft(viewsToday: number): number {
  return Math.max(0, adsMaxViewsPerDay() - Math.max(0, viewsToday))
}

export function adCooldownSecondsLeft(lastOpenedAt: number | null, now: number): number {
  if (lastOpenedAt === null) return 0
  return Math.max(0, Math.ceil((lastOpenedAt + adsCooldownMs() - now) / 1000))
}

export function adOpenRefusal(state: AdOpenState, now: number): AdRefusal | null {
  if (!adsConfigured()) return 'ads_disabled'
  if (state.hasReady) return 'pass_ready'
  if (state.hasPending) return 'ticket_open'
  if (adViewsLeft(state.viewsToday) <= 0) return 'daily_limit'
  if (adCooldownSecondsLeft(state.lastOpenedAt, now) > 0) return 'cooling_down'
  return null
}

const MIN_WATCH_MS = 3_000

export function adClaimTooFast(openedAt: number, now: number): boolean {
  return now - openedAt < MIN_WATCH_MS
}
