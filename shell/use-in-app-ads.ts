'use client'

import { useEffect } from 'react'
import { MONETAG_DEFAULT_ZONE_ID, monetagSdkName } from '@/domain/ads'
import {
  DEFAULT_IN_APP_ADS_SETTINGS,
  inAppShowParams,
  type InAppAdsSettings,
} from '@/domain/in-app-ads'
import { readShow, showFailureReason, waitForShow } from '@/shell/monetag-sdk'

/** Jeda sebelum mencoba lagi kalau fungsi global SDK belum tersedia. */
const SDK_RETRY_MS = 30_000

/**
 * Zone yang sudah menerima konfigurasi native pada dokumen ini. React dapat menjalankan
 * effect lagi saat state sesi berubah; memanggil payload `inApp` untuk kedua kalinya akan
 * membuat penjadwal otomatis tambahan di SDK.
 */
const initializedZones = new Set<string>()

export function useInAppAds({
  enabled,
  zoneId,
  settings = DEFAULT_IN_APP_ADS_SETTINGS,
}: {
  enabled: boolean
  zoneId: string
  settings?: InAppAdsSettings
}): void {
  useEffect(() => {
    if (!enabled || settings.frequency <= 0) return

    const sdkName = monetagSdkName(zoneId)
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const initialize = async () => {
      if (cancelled || initializedZones.has(sdkName)) return

      const show = readShow(sdkName) ?? (await waitForShow(sdkName))
      if (cancelled || initializedZones.has(sdkName)) return
      if (!show) {
        retryTimer = setTimeout(() => {
          void initialize()
        }, SDK_RETRY_MS)
        return
      }

      // Tandai sebelum memanggil SDK agar dua effect yang selesai menunggu bersamaan
      // tidak dapat mendaftarkan dua penjadwal untuk zone yang sama.
      initializedZones.add(sdkName)
      try {
        // Satu-satunya pemanggilan otomatis: SDK Monetag mengurus timeout, interval,
        // frequency, dan capping setelah menerima payload native ini.
        await show(inAppShowParams(settings))
      } catch (error) {
        console.warn('[ads] in-app show_<zone>() reject', showFailureReason(error))
      }
    }

    void initialize()

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
  }, [enabled, zoneId, settings])
}

/** Zone yang dipakai kalau env publiknya tidak diset — sama dengan script tag di layout. */
export function inAppZoneId(): string {
  return process.env.NEXT_PUBLIC_MONETAG_ZONE_ID?.trim() || MONETAG_DEFAULT_ZONE_ID
}
