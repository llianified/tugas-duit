'use client'

import { gigaPubFailureReason, type GigaPubShow } from '@/shell/gigapub-sdk'

/** Jeda setelah dokumen terlihat lagi sebelum tayangan dinyatakan ditinggal. Sebagian format berhadiah baru me-resolve promise-nya persis saat penonton kembali; tanpa jeda ini kepulangan yang sah ikut terbaca sebagai batal. */
const RETURN_GRACE_MS = 1_200

export type AdWatchOutcome =
  | { status: 'finished' }
  /** Penonton mengetuk kreatifnya lalu menekan back: iklannya hilang dari layar tanpa promise-nya pernah selesai. */
  | { status: 'abandoned' }
  | { status: 'failed'; reason: string }

/** `showGiga()` hanya resolve kalau tayangannya benar-benar tuntas, tapi ia juga tidak pernah reject saat penonton kabur ke halaman pengiklan — jadi tombolnya bisa menggantung di "Memuat" selamanya. Perginya dokumen lalu kembali dipakai sebagai tanda batal supaya UI selalu punya jawaban. */
export function watchAdToFinish(play: GigaPubShow): Promise<AdWatchOutcome> {
  return new Promise((resolve) => {
    let settled = false
    let leftPage = false
    let graceTimer: ReturnType<typeof setTimeout> | undefined

    const finish = (outcome: AdWatchOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(graceTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('pageshow', onReturn)
      resolve(outcome)
    }

    function onLeave() {
      leftPage = true
      clearTimeout(graceTimer)
    }

    function onReturn() {
      if (!leftPage || settled) return
      clearTimeout(graceTimer)
      graceTimer = setTimeout(() => finish({ status: 'abandoned' }), RETURN_GRACE_MS)
    }

    /** `pagehide`/`pageshow` untuk WebView yang menahan halaman di bfcache saat kreatifnya dibuka, `visibilitychange` untuk yang cuma menyembunyikannya. Dua-duanya dipasang karena WebView Telegram tidak konsisten mengirim keduanya. */
    function onVisibilityChange() {
      if (document.hidden) onLeave()
      else onReturn()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('pageshow', onReturn)

    try {
      void play().then(
        () => finish({ status: 'finished' }),
        (error: unknown) => finish({ status: 'failed', reason: gigaPubFailureReason(error) }),
      )
    } catch (error) {
      finish({ status: 'failed', reason: gigaPubFailureReason(error) })
    }
  })
}
