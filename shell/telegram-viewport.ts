'use client'

import { useEffect } from 'react'
import type { ResolvedTheme } from '@/shell/theme'

const TELEGRAM_CHROME_LIGHT = '#fafafa'
const TELEGRAM_CHROME_DARK = '#101014'

function telegramChromeColor() {
  const dark = document.documentElement.dataset.theme === 'dark'
  return dark ? TELEGRAM_CHROME_DARK : TELEGRAM_CHROME_LIGHT
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
      const color = telegramChromeColor()
      telegram.setHeaderColor?.(color)
      telegram.setBackgroundColor?.(color)
      telegram.setBottomBarColor?.(color)
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

export function useTelegramChromeColor(resolved: ResolvedTheme | null) {
  useEffect(() => {
    if (!resolved) return
    const telegram = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
      ?.WebApp
    if (!telegram) return

    const color = resolved === 'dark' ? TELEGRAM_CHROME_DARK : TELEGRAM_CHROME_LIGHT
    telegram.setHeaderColor?.(color)
    telegram.setBackgroundColor?.(color)
    telegram.setBottomBarColor?.(color)
  }, [resolved])
}
