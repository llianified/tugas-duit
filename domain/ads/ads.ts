import { economyConfig } from '../economy/economy-config'

export function adsMaxViewsPerDay(): number {
  return economyConfig().adsMaxViewsPerDay
}

export function adsCooldownMs(): number {
  return economyConfig().adsCooldownSeconds * 1000
}

export function adsConfigured(): boolean {
  return adsMaxViewsPerDay() > 0
}

/** Jaringan iklan yang dipakai. Sejak migrasi ke Monetag hanya ada satu, dan sengaja tetap ditulis sebagai union bernilai satu: nilainya ikut terkirim di `/api/session` dan `/api/ads/ticket`, jadi kalau nanti ada jaringan kedua yang perlu dicoba, penambahannya cukup di sini dan compiler yang menunjuk semua tempat yang harus ikut berubah (lihat `server/ad-provider.ts`). */
export type AdProvider = 'monetag'

/** Nilai aslinya ada di `domain/monetag-zone.ts` — modul daun tanpa import, supaya `server/env.ts` bisa memakainya tanpa menyeret alias `@/...` ke script CLI di `scripts/`. Di-re-export di sini supaya pemakai lama tetap bisa mengimpornya dari `@/domain/ads`. */
export { MONETAG_DEFAULT_ZONE_ID } from './monetag-zone'

/** Nama fungsi global yang disuntikkan SDK Monetag untuk satu zone. */
export function monetagSdkName(zoneId: string): string {
  return `show_${zoneId}`
}

export interface AdOpenState {
  viewsToday: number
  lastOpenedAt: number | null
  hasPending: boolean
  hasReady: boolean
  hasEntryOpen: boolean
}

export type AdRefusal =
  | 'ads_disabled'
  | 'daily_limit'
  | 'cooling_down'
  | 'ticket_open'
  | 'pass_ready'
  | 'entry_open'

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
  if (state.hasEntryOpen) return 'entry_open'
  if (state.hasPending) return 'ticket_open'
  if (adViewsLeft(state.viewsToday) <= 0) return 'daily_limit'
  if (adCooldownSecondsLeft(state.lastOpenedAt, now) > 0) return 'cooling_down'
  return null
}

const MIN_WATCH_MS = 3_000

export function adClaimTooFast(openedAt: number, now: number): boolean {
  return now - openedAt < MIN_WATCH_MS
}
