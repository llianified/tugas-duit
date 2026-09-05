'use client'

import { useEffect } from 'react'

/** Aplikasinya gelap-saja, jadi chrome Telegram cukup satu nilai — sama dengan `--background` di `globals.css`. Kalau nilai itu berubah, ubah di sini juga. */
const TELEGRAM_CHROME = '#101014'

/** Fullscreen hanya tersedia mulai Telegram Mini Apps 8.0.
 *
 * Bisa dimatikan lewat env supaya dugaan "fullscreen yang bikin iklan nembak dua kali" bisa
 * dibuktikan dengan satu deploy preview, bukan dengan mengubah kode tiap kali mencoba. Bawaannya
 * tetap menyala, jadi tidak ada yang berubah selama env-nya tidak diisi. */
const REQUEST_FULLSCREEN = process.env.NEXT_PUBLIC_TELEGRAM_FULLSCREEN !== '0'

/** Apakah kode perlu meminta fullscreen sendiri.
 *
 * Dipisah jadi fungsi murni karena di sinilah bug-nya dulu bersembunyi, dan bentuk `if` di dalam
 * effect tidak bisa diuji tanpa memalsukan seluruh `window.Telegram`. Yang dijaga cuma satu
 * kalimat: **jangan meminta keadaan yang sudah berlaku.** */
export function shouldRequestFullscreen(input: {
  enabled: boolean
  isFullscreen: boolean | undefined
  supportsFullscreen: boolean
}): boolean {
  if (!input.enabled) return false
  if (input.isFullscreen === true) return false
  return input.supportsFullscreen
}

type TelegramInset = { top: number; bottom: number; left: number; right: number }
type TelegramWebApp = {
  ready?: () => void
  expand?: () => void
  requestFullscreen?: () => void
  isVersionAtLeast?: (version: string) => boolean
  disableVerticalSwipes?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  isFullscreen?: boolean
  safeAreaInset?: TelegramInset
  contentSafeAreaInset?: TelegramInset
  onEvent?: (event: string, callback: () => void) => void
  offEvent?: (event: string, callback: () => void) => void
}

export function useTelegramViewport() {
  useEffect(() => {
    const telegram = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
      ?.WebApp
    if (!telegram) return

    const syncInsets = () => {
      const root = document.documentElement
      const safe = telegram.safeAreaInset
      const content = telegram.contentSafeAreaInset

      if (safe) {
        root.style.setProperty('--telegram-safe-top', `${safe.top}px`)
        root.style.setProperty('--telegram-safe-bottom', `${safe.bottom}px`)
      }
      if (content) {
        root.style.setProperty('--telegram-content-safe-top', `${content.top}px`)
        root.style.setProperty('--telegram-content-safe-bottom', `${content.bottom}px`)
      }
    }

    const syncControls = () => {
      if (telegram.isFullscreen) document.documentElement.dataset.telegramControls = 'true'
      else delete document.documentElement.dataset.telegramControls
    }

    const syncColors = () => {
      telegram.setHeaderColor?.(TELEGRAM_CHROME)
      telegram.setBackgroundColor?.(TELEGRAM_CHROME)
      telegram.setBottomBarColor?.(TELEGRAM_CHROME)
    }

    telegram.ready?.()
    syncColors()
    telegram.expand?.()
    telegram.disableVerticalSwipes?.()
    syncInsets()
    syncControls()
    telegram.onEvent?.('safeAreaChanged', syncInsets)
    telegram.onEvent?.('contentSafeAreaChanged', syncInsets)
    telegram.onEvent?.('themeChanged', syncColors)
    telegram.onEvent?.('fullscreenChanged', syncControls)

    /** `isFullscreen` diperiksa, dan itu bukan sekadar penghematan.
     *
     * BotFather punya setelannya sendiri untuk membuka Mini App langsung dalam mode fullscreen.
     * Kalau setelan itu menyala, `isFullscreen` sudah `true` saat effect ini jalan — dan blok ini
     * dulu tetap memanggil `requestFullscreen()`, meminta keadaan yang sudah berlaku. Telegram
     * Android menjawabnya dengan satu transisi fullscreen lagi: `fullscreenChanged` menyala,
     * viewport-nya berubah ukuran, dan SDK iklan yang membaca perubahan itu sebagai tampilan
     * halaman baru punya alasan untuk menembak sekali lagi.
     *
     * Itu juga menjelaskan kenapa gejalanya cuma di Telegram Android: di web.telegram.org dan di
     * web produksi langsung, `isVersionAtLeast('8.0')` tidak pernah true, jadi seluruh blok ini
     * memang tidak pernah jalan di sana. */
    if (
      shouldRequestFullscreen({
        enabled: REQUEST_FULLSCREEN,
        isFullscreen: telegram.isFullscreen,
        supportsFullscreen: telegram.isVersionAtLeast?.('8.0') === true,
      })
    ) {
      try {
        telegram.requestFullscreen?.()
      } catch {
        // Klien yang menolak permintaannya tetap dipakai apa adanya, tanpa fullscreen.
      }
    }

    return () => {
      telegram.offEvent?.('safeAreaChanged', syncInsets)
      telegram.offEvent?.('contentSafeAreaChanged', syncInsets)
      telegram.offEvent?.('themeChanged', syncColors)
      telegram.offEvent?.('fullscreenChanged', syncControls)
      delete document.documentElement.dataset.telegramControls
    }
  }, [])
}
