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
 * Maka jadwalnya dipegang sendiri, dan `type: 'inApp'` **tidak pernah** dikirim ke SDK.
 * Percobaan sebelumnya menetralkan jadwal SDK lewat `{ frequency: 1, capping: 0,
 * interval: 0, timeout: 0 }` justru membuatnya liar: `capping: 0` adalah jendela sepanjang
 * nol jam, jadi "1 iklan per 0 jam" tidak pernah membatasi apa pun, dan `interval: 0`
 * menghapus jeda antar iklan. Karena jadwal SDK tidak bisa dibatalkan, setiap panggilan
 * meninggalkan satu penjadwal tanpa plafon yang hidup terus — menumpuk tiap kali penjadwal
 * di sini berdetak, sampai iklannya tayang berlapis-lapis.
 *
 * Yang dipakai sekarang bentuk yang sama dengan jalur berhadiah: `show()` polos tanpa
 * parameter. Satu panggilan = satu iklan, Promise-nya settle, tidak ada jadwal yang
 * tertinggal di dalam SDK. Kapan panggilan itu terjadi sepenuhnya diputuskan di sini,
 * sehingga bisa ditahan selama iklan berhadiah sedang jalan.
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
 *
 * Dipakai sebagai cadangan saja — jadwal yang berlaku dibaca dari config ekonomi lewat
 * `inAppAdsSettings()`. Nilai ini yang jalan sebelum `/api/session` termuat, jadi bentuknya
 * disamakan dengan bawaan config supaya tidak ada lonjakan frekuensi di detik-detik awal.
 */
export const DEFAULT_IN_APP_ADS_SETTINGS: InAppAdsSettings = {
  frequency: 2,
  cappingHours: 0.1,
  intervalSeconds: 30,
  timeoutSeconds: 5,
  everyPage: false,
}

/**
 * Jadwal yang berlaku, diturunkan dari config ekonomi supaya frekuensi impresi bisa
 * dinaikkan atau diturunkan dari panel admin tanpa deploy — ini satu-satunya tuas
 * pemasukan yang efeknya langsung.
 *
 * `cappingHours` disimpan sebagai MENIT di config (`inAppAdsCappingMinutes`) karena seluruh
 * config ekonomi divalidasi sebagai bilangan bulat, sementara jendela pendek yang realistis
 * (6 menit) hanya bisa ditulis sebagai pecahan jam. Pembagian 60-nya terjadi di sini, satu
 * tempat saja.
 *
 * `everyPage` tidak ikut dijadikan field: config ekonomi hanya menerima angka, dan mereset
 * sesi tiap pindah halaman akan membuat plafon `frequency` tidak pernah berlaku di app yang
 * pindah view sesering ini.
 */
export function inAppAdsSettings(config: {
  inAppAdsFrequency: number
  inAppAdsCappingMinutes: number
  inAppAdsIntervalSeconds: number
  inAppAdsTimeoutSeconds: number
}): InAppAdsSettings {
  return {
    frequency: config.inAppAdsFrequency,
    cappingHours: config.inAppAdsCappingMinutes / 60,
    intervalSeconds: config.inAppAdsIntervalSeconds,
    timeoutSeconds: config.inAppAdsTimeoutSeconds,
    everyPage: false,
  }
}

/**
 * Parameter yang dikirim ke `show_<zone>()` supaya impresinya terhitung sebagai **InApp
 * Interstitial**, bukan Rewarded Interstitial.
 *
 * Formatnya ditentukan oleh ada-tidaknya `type: 'inApp'` pada pemanggilan, bukan oleh zone.
 * Selama jalur otomatis memakai `show()` polos, seluruh impresinya masuk ke bucket
 * berhadiah yang CPM-nya jauh lebih rendah (0.83 vs 2.83 di dashboard) — itu sebabnya
 * trafik naik tapi pemasukan jalan di tempat.
 *
 * Yang dikirim adalah jadwal apa adanya — nilai bawaan Monetag (`frequency: 2`,
 * `capping: 0.1`, `interval: 30`, `timeout: 5`, `everyPage: false`) atau apa pun yang
 * sedang aktif di config ekonomi. Tidak ada angka sintetis: `inAppSettings` yang dilihat
 * SDK sama dengan yang dipakai `nextInAppDelayMs()` di sisi kita, jadi kalau penjadwal SDK
 * ikut jalan, plafonnya identik dan tidak bisa lebih sering daripada jadwal kita sendiri.
 *
 * `capping` dikirim dalam JAM (satuan Monetag), bukan menit seperti di config.
 */
export function inAppShowParams(settings: InAppAdsSettings): {
  type: 'inApp'
  inAppSettings: {
    frequency: number
    capping: number
    interval: number
    timeout: number
    everyPage: boolean
  }
} {
  return {
    type: 'inApp',
    inAppSettings: {
      frequency: settings.frequency,
      capping: settings.cappingHours,
      interval: settings.intervalSeconds,
      timeout: settings.timeoutSeconds,
      everyPage: settings.everyPage,
    },
  }
}

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
