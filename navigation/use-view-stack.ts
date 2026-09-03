'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ROOT_VIEW, type AppView } from '@/navigation/app-view'

const NAV_STATE_KEY = 'tugasDuitViewStack'

const NAV_GUARD_KEY = 'tugasDuitViewStackGuard'

const VIEWS: Record<AppView, true> = {
  home: true,
  captcha: true,
  missions: true,
  history: true,
  referral: true,
  stats: true,
  leaderboard: true,
  profile: true,
}

function isAppView(value: unknown): value is AppView {
  return typeof value === 'string' && Object.hasOwn(VIEWS, value)
}

function readStack(state: unknown): AppView[] | null {
  if (typeof state !== 'object' || state === null) return null
  const raw = (state as Record<string, unknown>)[NAV_STATE_KEY]
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!raw.every(isAppView)) return null
  if (raw[0] !== ROOT_VIEW) return null
  return raw as AppView[]
}

function isGuardEntry(state: unknown): boolean {
  if (typeof state !== 'object' || state === null) return false
  return (state as Record<string, unknown>)[NAV_GUARD_KEY] === true
}

function carriedState() {
  const carried = { ...(window.history.state as object | null) } as Record<string, unknown>
  delete carried[NAV_STATE_KEY]
  delete carried[NAV_GUARD_KEY]
  return carried
}

function writeState(stack: AppView[]) {
  return { ...carriedState(), [NAV_STATE_KEY]: stack }
}

function writeGuardState() {
  return { ...carriedState(), [NAV_GUARD_KEY]: true }
}

type TelegramNavWebApp = {
  initData?: string
  BackButton?: { show?: () => void; hide?: () => void }
  onEvent?: (event: string, callback: () => void) => void
  offEvent?: (event: string, callback: () => void) => void
}

function telegramWebApp(): TelegramNavWebApp | undefined {
  return (window as Window & { Telegram?: { WebApp?: TelegramNavWebApp } }).Telegram?.WebApp
}

function insideTelegram(): boolean {
  return Boolean(telegramWebApp()?.initData)
}

export function useViewStack() {
  const [stack, setStack] = useState<AppView[]>([ROOT_VIEW])

  const stackRef = useRef<AppView[]>([ROOT_VIEW])
  const backPendingRef = useRef(false)

  const commit = useCallback((next: AppView[]) => {
    stackRef.current = next
    setStack(next)
  }, [])

  useEffect(() => {
    const saved = readStack(window.history.state)
    if (saved) {
      commit(saved)
      return
    }
    if (insideTelegram()) {
      window.history.replaceState(writeGuardState(), '')
      window.history.pushState(writeState([ROOT_VIEW]), '')
      return
    }
    window.history.replaceState(writeState([ROOT_VIEW]), '')
  }, [commit])

  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      backPendingRef.current = false

      const saved = readStack(event.state)
      if (saved) {
        commit(saved)
        return
      }

      if (isGuardEntry(event.state)) {
        window.history.pushState(writeState([ROOT_VIEW]), '')
        commit([ROOT_VIEW])
        return
      }

      commit([ROOT_VIEW])
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [commit])

  const push = useCallback(
    (view: AppView) => {
      const current = stackRef.current
      if (current[current.length - 1] === view) return
      const next = [...current, view]
      window.history.pushState(writeState(next), '')
      commit(next)
    },
    [commit],
  )

  const back = useCallback(() => {
    if (stackRef.current.length <= 1 || backPendingRef.current) return
    backPendingRef.current = true
    window.history.back()
  }, [])

  /** Nav pill adalah perpindahan menyamping: TUMPUKANNYA diganti — `[Beranda]` atau `[Beranda, tujuan]` — sehingga kedalaman, tombol back Telegram, dan `goBack()` memperlakukan Beranda sebagai satu-satunya induk. Yang diganti hanya tumpukannya; entri riwayatnya tetap DITAMBAH.
   *
   * Bentuk lamanya memakai `replaceState` saat kedalaman > 1, dan itu menimpa entri yang sedang ditempati user. Dari Beranda → Riwayat → Profil lalu menekan "Peringkat", entri Profil hilang tertimpa sehingga tombol Back mendarat di Riwayat — melompati view yang barusan ditinggalkan, dan menyisakan satu tekan tambahan sebelum sampai ke Beranda. `pushState` mengembalikan arti Back yang benar: satu tekan sama dengan satu view mundur, persis jalur yang dilalui user.
   *
   * Beranda ikut jalur yang sama, bukan dikecualikan: entri barunya membawa `[Beranda]`, jadi Back darinya mundur ke view sebelumnya alih-alih menabrak entri Beranda kedua yang membuat satu tekan tidak melakukan apa pun. */
  const select = useCallback(
    (view: AppView) => {
      const current = stackRef.current
      if (current[current.length - 1] === view) return
      const next: AppView[] = view === ROOT_VIEW ? [ROOT_VIEW] : [ROOT_VIEW, view]
      window.history.pushState(writeState(next), '')
      commit(next)
    },
    [commit],
  )

  const view = stack[stack.length - 1]

  useEffect(() => {
    document.querySelector<HTMLElement>('.app-scroll')?.scrollTo({ top: 0 })
  }, [view])

  const depth = stack.length
  useEffect(() => {
    const backButton = telegramWebApp()?.BackButton
    if (!backButton) return
    if (depth > 1) backButton.show?.()
    else backButton.hide?.()
  }, [depth])

  useEffect(() => {
    const telegram = telegramWebApp()
    if (!telegram?.onEvent) return
    const handleBackButton = () => back()
    telegram.onEvent('backButtonClicked', handleBackButton)
    return () => telegram.offEvent?.('backButtonClicked', handleBackButton)
  }, [back])

  useEffect(() => {
    return () => telegramWebApp()?.BackButton?.hide?.()
  }, [])

  return { view, depth, push, back, select }
}
