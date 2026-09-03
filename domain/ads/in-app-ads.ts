/** Konfigurasi native In-App Interstitial Monetag. Satu panggilan `show_<zone>({ type: 'inApp', inAppSettings })` mendaftarkan penjadwal otomatis di SDK. Pemanggil tidak boleh menambahkan timer tayang sendiri atau memanggil payload ini berulang-ulang dalam dokumen yang sama, karena setiap panggilan dapat membuat penjadwal native tambahan. */

export interface InAppAdsSettings {
  /** Banyak iklan yang ditayangkan dalam satu jendela capping. */
  frequency: number
  /** Panjang jendela capping dalam jam. Boleh pecahan, mis. 0.1 jam = 6 menit. */
  cappingHours: number
  /** Jeda minimum antara dua iklan, dalam detik. */
  intervalSeconds: number
  /** Tunda sebelum iklan pertama ditayangkan, dalam detik. */
  timeoutSeconds: number
  /** `false` mempertahankan sesi saat user berpindah halaman. */
  everyPage: boolean
}

/** Nilai bawaan resmi yang dipakai untuk zone Monetag aplikasi ini. */
export const DEFAULT_IN_APP_ADS_SETTINGS: InAppAdsSettings = {
  frequency: 2,
  cappingHours: 0.1,
  intervalSeconds: 30,
  timeoutSeconds: 5,
  everyPage: false,
}

/** Panjang jendela terpendek yang masih membuat jadwalnya berjalan seperti yang tertulis di panel.
 *
 * `interval` hanya berlaku DI DALAM satu jendela. Begitu jendela habis, hitungan frekuensi mulai dari nol dan `timeout` berjalan lagi — jadi jarak antara iklan terakhir sebuah jendela dan iklan pertama jendela berikutnya adalah `capping - (frequency - 1) * interval`, bukan `interval`. Kalau jendelanya pendek, angka itu jatuh di bawah jeda yang disetel admin dan iklan datang lebih cepat daripada yang diminta; pada `frequency: 1` jeda antar iklan berubah jadi panjang jendela dan nilai `interval` tidak pernah dipakai sama sekali.
 *
 * Dua syaratnya karena itu: seluruh iklan harus muat di jendelanya (`timeout + (frequency - 1) * interval`), dan pergantian jendela tidak boleh lebih rapat daripada jeda antar iklan (`frequency * interval`). */
export function minInAppWindowSeconds(settings: {
  frequency: number
  intervalSeconds: number
  timeoutSeconds: number
}): number {
  if (settings.frequency <= 0) return 0
  return Math.max(
    settings.timeoutSeconds + (settings.frequency - 1) * settings.intervalSeconds,
    settings.frequency * settings.intervalSeconds,
  )
}

/** Jadwal aktif berasal dari config ekonomi. Capping disimpan sebagai menit di panel admin, lalu diubah ke jam karena SDK Monetag membaca `capping` dalam satuan jam.
 *
 * Jendelanya dinaikkan ke `minInAppWindowSeconds()` kalau nilai tersimpan lebih pendek. Validator config sudah menolak kombinasi itu saat admin menyimpan, tapi baris yang tersimpan sebelum aturannya ada tetap dipakai apa adanya oleh `/api/session` tanpa divalidasi lagi — tanpa lantai ini, satu baris lama sudah cukup untuk membuat interstitial nembak sesering panjang jendelanya, bukan sesering jedanya. Yang dinaikkan sengaja jendelanya, bukan jedanya: jeda antar iklan adalah angka yang paling langsung dimaksud admin, sedangkan panjang jendela cuma pembungkusnya. */
export function inAppAdsSettings(config: {
  inAppAdsFrequency: number
  inAppAdsCappingMinutes: number
  inAppAdsIntervalSeconds: number
  inAppAdsTimeoutSeconds: number
}): InAppAdsSettings {
  const schedule = {
    frequency: config.inAppAdsFrequency,
    intervalSeconds: config.inAppAdsIntervalSeconds,
    timeoutSeconds: config.inAppAdsTimeoutSeconds,
  }
  const windowSeconds = Math.max(
    config.inAppAdsCappingMinutes * 60,
    minInAppWindowSeconds(schedule),
  )
  return {
    ...schedule,
    cappingHours: windowSeconds / 3600,
    everyPage: false,
  }
}

export interface InAppShowParams {
  type: 'inApp'
  inAppSettings: {
    frequency: number
    capping: number
    interval: number
    timeout: number
    everyPage: boolean
  }
}

/** Payload ini sengaja selalu memuat `type: 'inApp'`. Tanpa discriminator tersebut, Monetag menganggap `show_<zone>()` sebagai Rewarded Interstitial. */
export function inAppShowParams(settings: InAppAdsSettings): InAppShowParams {
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
