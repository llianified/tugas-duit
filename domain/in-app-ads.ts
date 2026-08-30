/**
 * Penjadwalan In-App Interstitial Monetag, ditulis ulang sebagai aturan murni.
 *
 * Monetag sendiri sudah bisa menjadwalkan: `show_<zone>({ type: 'inApp', inAppSettings })`
 * dipanggil sekali, lalu SDK-nya yang menghitung timeout/interval/capping di dalam. Tapi
 * begitu dipanggil, jadwal itu milik SDK — tidak ada API untuk menjeda atau membatalkannya.
 * Di aplikasi ini itu jadi masalah: `useAdPass` memakai zone yang sama untuk iklan
 * berhadiah, dan satu iklan otomatis yang nongol di tengah tontonan berhadiah membuat
 * Promise-nya reject, sehingga tiketnya gagal diklaim dan credit user hangus.
 *
 * Maka jadwalnya dipegang sendiri: SDK cuma disuruh menayangkan SATU iklan per panggilan
 * (lihat `IN_APP_SINGLE_SHOT_SETTINGS`), dan kapan panggilan itu terjadi diputuskan di
 * sini. Dengan begitu jadwalnya bisa ditahan selama iklan berhadiah sedang jalan.
 *
 * Modul ini tidak menyentuh `window`, timer, atau storage — hanya menjawab "berapa lama
 * lagi sampai iklan berikutnya boleh tayang". Efek sampingnya ada di
 * `shell/use-in-app-ads.ts`.
 */

export interface InAppAdsSettings {
  /** Banyak iklan yang ditayangkan dalam satu jendela capping. */
  frequency: number
  /** Panjang jendela capping dalam jam. Boleh pecahan, mis. 0.1 jam = 6 menit. */
  cappingHours: number
  /** Jeda minimum antara dua iklan di jendela yang sama. */
  intervalSeconds: number
  /** Tunda sebelum iklan pertama di satu jendela ditayangkan. */
  timeoutSeconds: number
  /**
   * `true` = sesi direset setiap pindah halaman, jadi hitungannya mulai dari nol lagi.
   * `false` = sesi disimpan, sehingga plafon `frequency` tetap berlaku lintas halaman.
   */
  everyPage: boolean
}

/**
 * Nilai dari dashboard Monetag: 2 iklan dalam 6 menit, jarak 30 detik, iklan pertama
 * setelah 5 detik, sesi ikut tersimpan saat pindah halaman.
 */
export const DEFAULT_IN_APP_ADS_SETTINGS: InAppAdsSettings = {
  frequency: 2,
  cappingHours: 0.1,
  intervalSeconds: 30,
  timeoutSeconds: 5,
  everyPage: false,
}

/**
 * Yang dikirim ke SDK di setiap panggilan. Semua angka penjadwalannya dimatikan supaya
 * SDK menayangkan satu iklan lalu berhenti — jadwal sebenarnya ada di `nextInAppDelayMs`.
 */
export const IN_APP_SINGLE_SHOT_SETTINGS = {
  type: 'inApp',
  inAppSettings: {
    frequency: 1,
    capping: 0,
    interval: 0,
    timeout: 0,
    everyPage: false,
  },
} as const

export interface InAppAdsSession {
  /** Awal jendela capping yang sedang berjalan. */
  startedAt: number
  /** Banyak iklan yang sudah tayang di jendela ini. */
  shown: number
  /** Kapan iklan terakhir tayang, atau `null` kalau jendela ini belum menayangkan apa pun. */
  lastShownAt: number | null
}

export function newInAppSession(now: number): InAppAdsSession {
  return { startedAt: now, shown: 0, lastShownAt: null }
}

function cappingMs(settings: InAppAdsSettings): number {
  return Math.max(0, settings.cappingHours) * 3_600_000
}

/**
 * Jendela capping habis begitu `cappingHours` terlewati sejak `startedAt`, lalu hitungan
 * `shown` mulai dari nol lagi. Tanpa penggulungan ini plafon `frequency` akan berlaku
 * seumur sesi, bukan per jendela.
 */
export function rollInAppSession(
  session: InAppAdsSession,
  settings: InAppAdsSettings,
  now: number,
): InAppAdsSession {
  return now - session.startedAt >= cappingMs(settings) ? newInAppSession(now) : session
}

export function recordInAppShown(session: InAppAdsSession, now: number): InAppAdsSession {
  return { ...session, shown: session.shown + 1, lastShownAt: now }
}

/**
 * Berapa milidetik lagi sampai iklan berikutnya boleh tayang.
 *
 * `null` berarti jendela ini sudah penuh — pemanggil harus menunggu jendelanya bergulir
 * (`msUntilInAppWindowReset`) alih-alih memasang timer tayang.
 */
export function nextInAppDelayMs(
  session: InAppAdsSession,
  settings: InAppAdsSettings,
  now: number,
): number | null {
  if (settings.frequency <= 0) return null
  if (session.shown >= settings.frequency) return null
  const earliest =
    session.lastShownAt === null
      ? session.startedAt + Math.max(0, settings.timeoutSeconds) * 1_000
      : session.lastShownAt + Math.max(0, settings.intervalSeconds) * 1_000
  return Math.max(0, earliest - now)
}

export function msUntilInAppWindowReset(
  session: InAppAdsSession,
  settings: InAppAdsSettings,
  now: number,
): number {
  return Math.max(0, session.startedAt + cappingMs(settings) - now)
}

/** Menyaring sesi hasil `JSON.parse` dari storage: bentuk asing diperlakukan sebagai sesi baru. */
export function parseInAppSession(value: unknown): InAppAdsSession | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const startedAt = raw.startedAt
  const shown = raw.shown
  const lastShownAt = raw.lastShownAt
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return null
  if (typeof shown !== 'number' || !Number.isInteger(shown) || shown < 0) return null
  if (lastShownAt !== null && (typeof lastShownAt !== 'number' || !Number.isFinite(lastShownAt))) {
    return null
  }
  return { startedAt, shown, lastShownAt }
}
