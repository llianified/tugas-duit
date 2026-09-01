'use client'

import { useEffect } from 'react'

/**
 * Aplikasinya gelap-saja, jadi chrome Telegram cukup satu nilai — sama dengan
 * `--background` di `globals.css`. Kalau nilai itu berubah, ubah di sini juga.
 */
const TELEGRAM_CHROME = '#101014'

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

    if (telegram.isVersionAtLeast?.('8.0') === true) {
      try {
        telegram.requestFullscreen?.()
      } catch {
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
