import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IN_APP_ADS_SETTINGS,
  inAppAdsSettings,
  inAppShowParams,
  minInAppWindowSeconds,
} from './in-app-ads'

describe('INAPP-1 — payload native Monetag', () => {
  it('memakai jadwal bawaan 2 tayangan per 6 menit', () => {
    expect(DEFAULT_IN_APP_ADS_SETTINGS).toEqual({
      frequency: 2,
      cappingHours: 0.1,
      intervalSeconds: 30,
      timeoutSeconds: 5,
      everyPage: false,
    })
  })

  it('selalu membedakan iklan otomatis sebagai inApp', () => {
    expect(inAppShowParams(DEFAULT_IN_APP_ADS_SETTINGS)).toEqual({
      type: 'inApp',
      inAppSettings: {
        frequency: 2,
        capping: 0.1,
        interval: 30,
        timeout: 5,
        everyPage: false,
      },
    })
  })

  it('tidak membawa identitas tiket rewarded atau masuk ke jalur minimum watch', () => {
    const params = inAppShowParams(DEFAULT_IN_APP_ADS_SETTINGS)

    expect(params).not.toHaveProperty('ymid')
    expect(params).not.toHaveProperty('requestVar')
    expect(Object.keys(params)).toEqual(['type', 'inAppSettings'])
  })
})

describe('INAPP-2 — config ekonomi ke satuan SDK', () => {
  it('mengubah capping menit menjadi jam dan mempertahankan sesi lintas halaman', () => {
    expect(
      inAppAdsSettings({
        inAppAdsFrequency: 3,
        inAppAdsCappingMinutes: 12,
        inAppAdsIntervalSeconds: 45,
        inAppAdsTimeoutSeconds: 10,
      }),
    ).toEqual({
      frequency: 3,
      cappingHours: 0.2,
      intervalSeconds: 45,
      timeoutSeconds: 10,
      everyPage: false,
    })
  })
})

describe('INAPP-3 — jendela tidak boleh bergulir lebih rapat daripada jedanya', () => {
  it('menaikkan jendela yang lebih pendek daripada jeda antar iklan', () => {
    // Persis kombinasi yang bikin interstitial nembak dua kali di produksi: | jendela 1 menit habis lebih dulu daripada jeda 120 detik, lalu jendela baru | menjalankan tunda 10 detik dari nol — iklan berikutnya datang di detik ke-70.
    expect(
      inAppAdsSettings({
        inAppAdsFrequency: 1,
        inAppAdsCappingMinutes: 1,
        inAppAdsIntervalSeconds: 120,
        inAppAdsTimeoutSeconds: 10,
      }),
    ).toEqual({
      frequency: 1,
      cappingHours: 120 / 3600,
      intervalSeconds: 120,
      timeoutSeconds: 10,
      everyPage: false,
    })
  })

  it('membiarkan jendela yang sudah cukup panjang apa adanya', () => {
    expect(
      inAppAdsSettings({
        inAppAdsFrequency: 2,
        inAppAdsCappingMinutes: 6,
        inAppAdsIntervalSeconds: 30,
        inAppAdsTimeoutSeconds: 5,
      }).cappingHours,
    ).toBe(0.1)
  })

  it('menghitung lantai jendela dari syarat muat maupun syarat tempo', () => {
    // Tunda panjang: yang mengikat adalah semua iklan harus muat di jendelanya.
    expect(
      minInAppWindowSeconds({ frequency: 2, intervalSeconds: 30, timeoutSeconds: 300 }),
    ).toBe(330)
    // Tunda pendek: yang mengikat adalah pergantian jendela tidak boleh lebih rapat | daripada jeda antar iklan.
    expect(
      minInAppWindowSeconds({ frequency: 2, intervalSeconds: 300, timeoutSeconds: 5 }),
    ).toBe(600)
  })

  it('tidak menuntut apa pun saat interstitial dimatikan', () => {
    expect(
      minInAppWindowSeconds({ frequency: 0, intervalSeconds: 300, timeoutSeconds: 5 }),
    ).toBe(0)
  })
})
