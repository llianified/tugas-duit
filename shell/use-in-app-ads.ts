'use client'

import { useEffect } from 'react'
import { MONETAG_DEFAULT_ZONE_ID, monetagSdkName } from '@/domain/ads'
import {
  DEFAULT_IN_APP_ADS_SETTINGS,
  IN_APP_SINGLE_SHOT_SETTINGS,
  msUntilInAppWindowReset,
  newInAppSession,
  nextInAppDelayMs,
  parseInAppSession,
  recordInAppShown,
  rollInAppSession,
  type InAppAdsSession,
  type InAppAdsSettings,
} from '@/domain/in-app-ads'
import { beginInApp, endInApp, isRewardedActive, subscribeAdGate } from '@/shell/ad-gate'
import { readShow, showFailureReason, waitForShow } from '@/shell/monetag-sdk'

/**
 * Interstitial otomatis Monetag: efek sampingnya di sini, aturan kapan tayangnya di
 * `domain/in-app-ads.ts`.
 *
 * Jadwalnya dipegang sendiri alih-alih diserahkan ke SDK karena jadwal milik SDK tidak
 * bisa dijeda, sementara zone ini dipakai bersama iklan berhadiah — alasan lengkapnya ada
 * di komentar `domain/in-app-ads.ts` dan `shell/ad-gate.ts`.
 */

const SESSION_KEY = 'tugasduit.in-app-ads.session'

/** Jeda sebelum mencoba lagi kalau SDK-nya tidak muncul dalam jendela tunggu. */
const SDK_RETRY_MS = 30_000

/**
 * Sesi ditaruh di `sessionStorage`, bukan state React: `everyPage: false` berarti plafon
 * `frequency` harus tetap berlaku setelah muat ulang halaman, dan state React hilang di
 * situ. `sessionStorage` juga otomatis bersih saat tab ditutup, yang memang arti "sesi".
 */
function readStoredSession(settings: InAppAdsSettings, now: number): InAppAdsSession {
  if (settings.everyPage) return newInAppSession(now)
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    const parsed = raw ? parseInAppSession(JSON.parse(raw) as unknown) : null
    return parsed ? rollInAppSession(parsed, settings, now) : newInAppSession(now)
  } catch {
    // WebView dengan storage terkunci tidak boleh mematikan iklan; sesi baru saja.
    return newInAppSession(now)
  }
}

function writeStoredSession(session: InAppAdsSession): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Diabaikan: kehilangan sesi paling buruk hanya membuat hitungan mulai dari nol.
  }
}

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
    if (!enabled) return

    const sdkName = monetagSdkName(zoneId)
    let session = readStoredSession(settings, Date.now())
    let timer: ReturnType<typeof setTimeout> | undefined
    let showing = false
    let cancelled = false

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void run()
      }, ms)
    }

    /**
     * Menghitung ulang kapan tayangan berikutnya boleh jalan, lalu memasang satu timer.
     *
     * Saat iklan berhadiah aktif atau aplikasi di latar belakang, sengaja TIDAK ada timer
     * yang dipasang: yang membangunkan jadwalnya adalah `subscribeAdGate` dan
     * `visibilitychange`. Kalau di sini dipasang timer polling, iklan bisa tetap nongol
     * tepat di jendela yang mau dihindari.
     */
    const plan = () => {
      if (cancelled || showing) return
      const now = Date.now()
      session = rollInAppSession(session, settings, now)
      const delay = nextInAppDelayMs(session, settings, now)
      if (delay === null) {
        // Jendela capping penuh — tunggu sampai bergulir, plus sedikit agar tidak
        // terbangun persis di batas dan menghitung jendela lama.
        schedule(msUntilInAppWindowReset(session, settings, now) + 250)
        return
      }
      if (isRewardedActive() || document.hidden) return
      schedule(delay)
    }

    const run = async () => {
      if (cancelled || showing) return
      if (isRewardedActive() || document.hidden) return

      const now = Date.now()
      session = rollInAppSession(session, settings, now)
      const delay = nextInAppDelayMs(session, settings, now)
      if (delay === null || delay > 0) {
        plan()
        return
      }

      const show = readShow(sdkName) ?? (await waitForShow(sdkName))
      if (cancelled) return
      if (!show) {
        schedule(SDK_RETRY_MS)
        return
      }
      // Palang dinaikkan sebelum menunggu, bukan sesudah: `useAdPass` harus melihat
      // interstitial ini sedang tayang sejak detik pertama.
      showing = true
      beginInApp()
      try {
        await show(IN_APP_SINGLE_SHOT_SETTINGS)
      } catch (error) {
        // Reject di sini tidak merugikan siapa pun — tidak ada tiket dan tidak ada credit
        // yang bergantung padanya, beda dengan sisi berhadiah. Cukup dicatat.
        console.warn('[ads] in-app show_<zone>() reject', showFailureReason(error))
      } finally {
        endInApp()
        showing = false
      }
      /**
       * Dihitung tayang walau reject. Kalau hanya tayangan sukses yang dihitung, stok
       * iklan yang kosong membuat `shown` tidak pernah naik dan penjadwalnya memanggil
       * SDK terus-menerus sepanjang jendela.
       */
      session = recordInAppShown(session, Date.now())
      writeStoredSession(session)
      plan()
    }

    const unsubscribeGate = subscribeAdGate(() => {
      if (!isRewardedActive()) plan()
    })
    const onVisibility = () => {
      if (!document.hidden) plan()
    }
    document.addEventListener('visibilitychange', onVisibility)

    plan()

    return () => {
      cancelled = true
      clearTimeout(timer)
      unsubscribeGate()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, zoneId, settings])
}

/** Zone yang dipakai kalau env publiknya tidak diset — sama dengan script tag di layout. */
export function inAppZoneId(): string {
  return process.env.NEXT_PUBLIC_MONETAG_ZONE_ID?.trim() || MONETAG_DEFAULT_ZONE_ID
}
