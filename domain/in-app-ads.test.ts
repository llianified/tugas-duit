import { describe, expect, it } from 'vitest'
import * as inAppAds from './in-app-ads'
import {
  DEFAULT_IN_APP_ADS_SETTINGS,
  msUntilInAppWindowReset,
  newInAppSession,
  nextInAppDelayMs,
  parseInAppSession,
  recordInAppShown,
  rollInAppSession,
  type InAppAdsSettings,
} from './in-app-ads'

const T0 = 1_000_000
const CAPPING_MS = DEFAULT_IN_APP_ADS_SETTINGS.cappingHours * 3_600_000
const TIMEOUT_MS = DEFAULT_IN_APP_ADS_SETTINGS.timeoutSeconds * 1_000
const INTERVAL_MS = DEFAULT_IN_APP_ADS_SETTINGS.intervalSeconds * 1_000

const withSettings = (patch: Partial<InAppAdsSettings>): InAppAdsSettings => ({
  ...DEFAULT_IN_APP_ADS_SETTINGS,
  ...patch,
})

describe('INAPP-1 — jadwal tidak pernah diserahkan ke SDK', () => {
  /**
   * Penjaga terhadap penyebab gangguan sebelumnya: `show_<zone>({ type: 'inApp',
   * inAppSettings })` menitipkan jadwal ke SDK yang tidak bisa dibatalkan, dan setiap
   * panggilan meninggalkan satu penjadwal baru sampai iklannya tayang berlapis-lapis.
   * Modul ini hanya boleh menjawab "kapan", tidak pernah membentuk payload jadwal.
   */
  it('tidak mengekspor payload penjadwalan apa pun untuk SDK', () => {
    const serialized = JSON.stringify(
      Object.fromEntries(
        Object.entries(inAppAds).filter(([, value]) => typeof value !== 'function'),
      ),
    )
    expect(serialized).not.toContain('inAppSettings')
    expect(serialized).not.toContain('capping"')
  })
})

describe('INAPP-2 — iklan pertama menunggu timeout, berikutnya menunggu interval', () => {
  it('menahan iklan pertama selama timeoutSeconds sejak jendela dimulai', () => {
    const session = newInAppSession(T0)

    expect(session).toEqual({ startedAt: T0, shown: 0, lastShownAt: null })
    expect(nextInAppDelayMs(session, DEFAULT_IN_APP_ADS_SETTINGS, T0)).toBe(TIMEOUT_MS)
    expect(nextInAppDelayMs(session, DEFAULT_IN_APP_ADS_SETTINGS, T0 + TIMEOUT_MS)).toBe(0)
  })

  it('menahan iklan berikutnya selama intervalSeconds sejak tayangan terakhir', () => {
    const shownAt = T0 + TIMEOUT_MS
    const session = recordInAppShown(newInAppSession(T0), shownAt)

    expect(session).toEqual({ startedAt: T0, shown: 1, lastShownAt: shownAt })
    expect(nextInAppDelayMs(session, DEFAULT_IN_APP_ADS_SETTINGS, shownAt)).toBe(INTERVAL_MS)
    expect(nextInAppDelayMs(session, DEFAULT_IN_APP_ADS_SETTINGS, shownAt + INTERVAL_MS)).toBe(0)
  })

  it('tidak pernah mengembalikan jeda negatif walau jam acuannya sudah lama lewat', () => {
    const session = newInAppSession(T0)
    expect(nextInAppDelayMs(session, DEFAULT_IN_APP_ADS_SETTINGS, T0 + 10 * CAPPING_MS)).toBe(0)
  })
})

describe('INAPP-3 — plafon frequency menutup jendela', () => {
  it('mengembalikan null begitu jatah jendela habis', () => {
    let session = newInAppSession(T0)
    for (let index = 0; index < DEFAULT_IN_APP_ADS_SETTINGS.frequency; index += 1) {
      expect(nextInAppDelayMs(session, DEFAULT_IN_APP_ADS_SETTINGS, T0 + CAPPING_MS - 1)).not.toBeNull()
      session = recordInAppShown(session, T0 + index * INTERVAL_MS)
    }

    expect(session.shown).toBe(DEFAULT_IN_APP_ADS_SETTINGS.frequency)
    expect(nextInAppDelayMs(session, DEFAULT_IN_APP_ADS_SETTINGS, T0 + CAPPING_MS - 1)).toBeNull()
  })

  it('frequency nol mematikan penjadwalnya sepenuhnya', () => {
    const mati = withSettings({ frequency: 0 })
    expect(nextInAppDelayMs(newInAppSession(T0), mati, T0 + TIMEOUT_MS)).toBeNull()
  })
})

describe('INAPP-4 — jendela capping bergulir', () => {
  it('mempertahankan jendela selama cappingHours belum terlewati', () => {
    const session = recordInAppShown(newInAppSession(T0), T0)
    expect(rollInAppSession(session, DEFAULT_IN_APP_ADS_SETTINGS, T0 + CAPPING_MS - 1)).toBe(session)
  })

  it('memulai jendela baru tepat saat cappingHours terlewati', () => {
    const session = recordInAppShown(newInAppSession(T0), T0)
    const rolled = rollInAppSession(session, DEFAULT_IN_APP_ADS_SETTINGS, T0 + CAPPING_MS)

    expect(rolled).toEqual({ startedAt: T0 + CAPPING_MS, shown: 0, lastShownAt: null })
  })

  it('menghitung sisa waktu sampai jendelanya bergulir', () => {
    const session = newInAppSession(T0)
    expect(msUntilInAppWindowReset(session, DEFAULT_IN_APP_ADS_SETTINGS, T0)).toBe(CAPPING_MS)
    expect(msUntilInAppWindowReset(session, DEFAULT_IN_APP_ADS_SETTINGS, T0 + CAPPING_MS)).toBe(0)
    expect(msUntilInAppWindowReset(session, DEFAULT_IN_APP_ADS_SETTINGS, T0 + 2 * CAPPING_MS)).toBe(0)
  })
})

describe('INAPP-5 — sesi dari storage disaring', () => {
  it('menerima bentuk yang benar', () => {
    expect(parseInAppSession({ startedAt: T0, shown: 2, lastShownAt: T0 + 1 })).toEqual({
      startedAt: T0,
      shown: 2,
      lastShownAt: T0 + 1,
    })
    expect(parseInAppSession({ startedAt: T0, shown: 0, lastShownAt: null })).toEqual({
      startedAt: T0,
      shown: 0,
      lastShownAt: null,
    })
  })

  it('menolak bentuk asing supaya tidak jadi jadwal yang aneh', () => {
    expect(parseInAppSession(null)).toBeNull()
    expect(parseInAppSession('sesi')).toBeNull()
    expect(parseInAppSession({})).toBeNull()
    expect(parseInAppSession({ startedAt: T0, shown: 1 })).toBeNull()
    expect(parseInAppSession({ startedAt: 'kemarin', shown: 1, lastShownAt: null })).toBeNull()
    expect(parseInAppSession({ startedAt: Number.NaN, shown: 1, lastShownAt: null })).toBeNull()
    expect(parseInAppSession({ startedAt: T0, shown: -1, lastShownAt: null })).toBeNull()
    expect(parseInAppSession({ startedAt: T0, shown: 1.5, lastShownAt: null })).toBeNull()
    expect(parseInAppSession({ startedAt: T0, shown: 1, lastShownAt: 'tadi' })).toBeNull()
  })
})
