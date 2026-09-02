import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IN_APP_ADS_SETTINGS,
  inAppAdsSettings,
  inAppShowParams,
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
