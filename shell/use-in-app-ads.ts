'use client'

import { useEffect } from 'react'
import { MONETAG_DEFAULT_ZONE_ID, monetagSdkName } from '@/domain/ads/ads'
import {
  DEFAULT_IN_APP_ADS_SETTINGS,
  inAppShowParams,
  type InAppAdsSettings,
} from '@/domain/ads/in-app-ads'
import { readShow, showFailureReason, waitForShow } from '@/shell/monetag-sdk'

/** Jeda sebelum mencoba lagi kalau fungsi global SDK belum tersedia. */
const SDK_RETRY_MS = 30_000

/** Zone yang sudah menerima konfigurasi native pada dokumen ini. React dapat menjalankan effect lagi saat state sesi berubah; memanggil payload `inApp` untuk kedua kalinya akan membuat penjadwal otomatis tambahan di SDK. */
const initializedZones = new Set<string>()

/** Menahan PENDAFTARAN jadwal selama task berjalan — dan hanya itu yang bisa dijanjikan.
 *
 * Monetag tidak menyediakan pause, cancel, atau resume resmi untuk penjadwal in-app: sekali `show_<zone>({ type: 'inApp' })` diterima, jadwalnya hidup sampai dokumennya mati (lihat `docs/keputusan-desain.md`). Jadi begitu terdaftar, interstitial TETAP bisa jatuh di tengah captcha, dan bayaran task memang ditentukan waktu (`getStars`) — kerugian itu belum hilang.
 *
 * Yang dipotong di sini cuma tabrakan yang paling sering dan paling murah dihindari: tayangan PERTAMA. Dengan `timeoutSeconds` bawaan 5 detik, jadwal yang didaftarkan begitu sesi termuat menembak persis saat user menekan "Mulai" di detik-detik pertama. Menunda pendaftaran sampai user tidak sedang mengerjakan task menggeser tayangan pertama itu ke luar task, tanpa membatalkan apa pun, tanpa menyentuh format, dan tanpa menambah penjadwal kedua. Impresinya tidak berkurang — hanya bergeser.
 *
 * Selebihnya butuh kontrol jadwal yang SDK ini tidak berikan; jangan mengarang kontrol itu dari luar. */
export function useInAppAds({
  enabled,
  zoneId,
  settings = DEFAULT_IN_APP_ADS_SETTINGS,
}: {
  /** Sudah termasuk "tidak sedang mengerjakan task". Jadwal yang terlanjur terdaftar tidak terpengaruh nilai ini. */
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

      // Tandai sebelum memanggil SDK agar dua effect yang selesai menunggu bersamaan | tidak dapat mendaftarkan dua penjadwal untuk zone yang sama.
      initializedZones.add(sdkName)
      try {
        // Satu-satunya pemanggilan otomatis: SDK Monetag mengurus timeout, interval, | frequency, dan capping setelah menerima payload native ini.
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
