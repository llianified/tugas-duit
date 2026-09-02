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

/** Jadwal aktif berasal dari config ekonomi. Capping disimpan sebagai menit di panel admin, lalu diubah ke jam karena SDK Monetag membaca `capping` dalam satuan jam. */
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
