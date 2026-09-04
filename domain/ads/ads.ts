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

/** Tiket yang ADA di potret sesi belum tentu masih hidup: potretnya diambil sekali, tenggatnya terus berjalan. Setiap keputusan klien yang berdasar tiket harus lewat bentuk ini, bukan sekadar "ada tiket di potret" — `consumeAdPass` di server menuntut `expires_at > now()`, jadi keputusan yang lebih longgar berakhir sebagai permintaan yang pasti ditolak. `now` sudah dikoreksi ke jam server oleh pemanggilnya. */
export function adPassUsable(pass: { expiresAt: number } | null | undefined, now: number): boolean {
  return pass !== null && pass !== undefined && pass.expiresAt > now
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

/** Lantai lama tinggal jadi bawaannya. Angkanya dulu konstanta yang hanya MENCATAT sinyal fraud lalu tetap menerbitkan tiket — jadi "tap iklan lalu back" terdeteksi tapi tidak pernah ditahan. Sekarang ia setelan panel dan benar-benar menolak. */
export function adsMinWatchSeconds(): number {
  return economyConfig().adsMinWatchSeconds
}

/** Lama tontonan yang benar-benar terjadi, diukur dari saat tiket dibuka sampai klaimnya masuk. Kedua ujungnya jam Postgres (`ad_views.created_at` dan `now()`), bukan jam perangkat — klien tidak bisa mengarangnya, dan satu-satunya cara memperbesarnya adalah benar-benar menunggu. */
export function adWatchedMs(openedAt: number, now: number): number {
  return Math.max(0, now - openedAt)
}

/** Tontonan yang terlalu pendek untuk mungkin nyata. Ini penjaga yang TIDAK bergantung pada Monetag: ia tetap berlaku saat gerbang postback mati, dan tetap berlaku kalau penyedia iklan ternyata membayar klik yang langsung ditutup. | Jendelanya ikut memuat waktu memuat SDK (`waitForShow`), jadi angka yang disetel selalu lebih longgar daripada durasi kreatifnya sendiri — pilih dari sebaran `ready_at - created_at` yang sudah tercatat, bukan dari durasi iklan yang diperkirakan. | Nol mematikan penjagaan ini sepenuhnya. */
export function adWatchTooShort(openedAt: number, now: number): boolean {
  const floorMs = adsMinWatchSeconds() * 1_000
  if (floorMs <= 0) return false
  return adWatchedMs(openedAt, now) < floorMs
}
