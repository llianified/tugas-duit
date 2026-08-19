'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { GlyphMoon, GlyphSun } from '@/shared/components/glyph'
import { THEME_DARK_QUERY, THEME_STORAGE_KEY } from '@/shell/theme-init'
import { cn } from '@/shared/lib/utils'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  preference: ThemePreference
  resolved: ResolvedTheme | null
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system')
  const [resolved, setResolved] = useState<ResolvedTheme | null>(null)

  useEffect(() => {
    setPreference(readStoredPreference())
  }, [])

  useEffect(() => {
    const query = window.matchMedia(THEME_DARK_QUERY)

    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && query.matches)
      const root = document.documentElement
      root.classList.add('theme-switching')
      root.dataset.theme = dark ? 'dark' : 'light'
      setResolved(dark ? 'dark' : 'light')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.classList.remove('theme-switching')
        })
      })
    }

    apply()
    if (preference !== 'system') return

    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [preference])

  const toggle = useCallback(() => {
    setPreference((current) => {
      const currentDark =
        current === 'dark' ||
        (current === 'system' && window.matchMedia(THEME_DARK_QUERY).matches)
      const next: ThemePreference = currentDark ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ preference, resolved, toggle }), [preference, resolved, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme dipakai di luar ThemeProvider')
  return value
}

export function ThemeToggleSkeleton() {
  return (
    <div
      aria-hidden
      className="brand-band-control ml-1.5 flex aspect-square h-[var(--brand-pill-h)] shrink-0 animate-pulse items-center justify-center rounded-[calc(var(--brand-pill-h)/2)] bg-muted"
    />
  )
}

export function ThemeToggle({ hidden = false }: { hidden?: boolean }) {
  const { resolved, toggle } = useTheme()

  const target = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={hidden}
      aria-label={target === 'dark' ? 'Ganti ke tampilan gelap' : 'Ganti ke tampilan terang'}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      data-aside={hidden ? '' : undefined}
      className={cn(
        'focus-ring brand-band-control h-[var(--brand-pill-h)] aspect-square rounded-[calc(var(--brand-pill-h)/2)] ml-1.5 flex shrink-0 items-center justify-center bg-muted text-muted-foreground hover:text-foreground active:text-foreground',
      )}
    >
      <span
        className={cn(
          'relative block size-4 transition-opacity duration-[var(--duration-ui)] ease-out',
          resolved === null && 'opacity-0',
        )}
      >
        <GlyphSun
          className={cn(
            'theme-glyph absolute inset-0',
            target === 'dark' ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100',
          )}
        />
        <GlyphMoon
          className={cn(
            'theme-glyph absolute inset-0',
            target === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0',
          )}
        />
      </span>
    </button>
  )
}
