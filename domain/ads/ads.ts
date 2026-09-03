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

/** Gerbang verifikasi postback. Saat menyala, pass hanya diterbitkan oleh konfirmasi Monetag (`settleAdPostback`) — klaim dari klien berubah jadi pertanyaan, bukan perintah. Disimpan sebagai setelan panel, bukan konstanta, karena menyalakannya sebelum URL postback terisi di dashboard Monetag membuat seluruh tiket berhenti keluar; urutan amannya adalah deploy dulu, buktikan `verified_at` terisi, baru nyalakan. */
export function adsPostbackRequired(): boolean {
  return economyConfig().adsPostbackRequired === 1
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ticket ID adalah `ad_views.id`. Bentuknya diperiksa sebelum menyentuh DB karena nilainya datang dari dua sumber yang sama-sama tidak dipercaya: body klaim dari klien dan makro `ymid` pada postback. */
export function isTicketId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/** Provider ikut terkirim di `/api/session` dan `/api/ads/ticket`. Sekarang hanya satu — tetap dipertahankan sebagai field, bukan dihapus, karena `ad_views.block_id` yang sudah tersimpan berisi campuran unit dari jaringan lama dan klien perlu tahu SDK mana yang dimaksud satu tiket. */
export type AdProvider = 'monetag'

/** Konstanta jaringan disimpan di modul daun tanpa import agar aman dipakai dari runtime server maupun layout. */
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
  /** Ongkos masuk yang sudah dibayar pass dan belum ditutup — challenge maupun ronde Arena. */
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

/** Tenggat cooldown, bukan sisa detiknya. Yang dikirim ke klien harus titik akhir yang tetap: sisa detik ikut basi seiring waktu berjalan, sedangkan tenggat tetap benar berapa lama pun potret sesi itu dipegang. */
export function adCooldownUntil(lastOpenedAt: number | null): number | null {
  if (lastOpenedAt === null) return null
  return lastOpenedAt + adsCooldownMs()
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
