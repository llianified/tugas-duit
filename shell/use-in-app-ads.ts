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

/** Zone yang sudah menerima konfigurasi native pada dokumen ini. React dapat menjalankan effect lagi saat state sesi berubah; memanggil payload `inApp` untuk kedua kalinya akan membuat penjadwal otomatis tambahan di SDK.
 *
 * Ditaruh di `window`, bukan di lingkup modul, dan itu bukan gaya. Penjadwal Monetag hidup di
 * DOKUMEN — sekali terdaftar ia jalan sampai dokumennya mati. Penjaga yang hidup di lingkup modul
 * cuma menjaga satu instance modul, jadi dokumen yang entah bagaimana memuat bundel ini dua kali
 * mendapat dua `Set` kosong dan mendaftarkan dua penjadwal untuk zone yang sama. Penjaganya harus
 * hidup di tempat yang sama dengan yang dijaga.
 *
 * Hitungannya ikut disimpan supaya pertanyaan "apakah kodenya yang memanggil dua kali, atau SDK-nya
 * yang menembak dua kali dari satu panggilan" bisa dijawab dengan melihat, bukan menebak. */
interface InAppAdsRegistry {
  zones: Set<string>
  calls: { zone: string; at: number }[]
}

const REGISTRY_KEY = '__tugasDuitInAppAds'

function registry(): InAppAdsRegistry {
  const host = globalThis as unknown as Record<string, InAppAdsRegistry | undefined>
  const existing = host[REGISTRY_KEY]
  if (existing) return existing
  const created: InAppAdsRegistry = { zones: new Set<string>(), calls: [] }
  host[REGISTRY_KEY] = created
  return created
}

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
      const registered = registry()
      if (cancelled || registered.zones.has(sdkName)) return

      const show = readShow(sdkName) ?? (await waitForShow(sdkName))
      if (cancelled) return
      /** Pendaftaran kedua yang tertahan di sini bukan keadaan normal — ia berarti ada jalur yang
       * mencoba mendaftar dua kali, dan itu justru yang sedang dicari saat interstitial menembak
       * ganda. Dulu ia pulang diam-diam; sekarang ia meninggalkan jejak. */
      if (registered.zones.has(sdkName)) {
        console.warn('[ads] in-app pendaftaran kedua ditahan', sdkName, registered.calls.length)
        return
      }
      if (!show) {
        retryTimer = setTimeout(() => {
          void initialize()
        }, SDK_RETRY_MS)
        return
      }

      // Tandai sebelum memanggil SDK agar dua effect yang selesai menunggu bersamaan | tidak dapat mendaftarkan dua penjadwal untuk zone yang sama.
      registered.zones.add(sdkName)
      registered.calls.push({ zone: sdkName, at: Date.now() })
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
