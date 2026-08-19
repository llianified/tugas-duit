'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { BrandBand } from '@/shared/components/brand-band'
import { cn } from '@/shared/lib/utils'
import { ThemeToggle, ThemeToggleSkeleton } from '@/shell/theme'

function useDocumentScrollLock() {
  useEffect(() => {
    document.documentElement.dataset.appScrollLock = 'true'
    return () => {
      delete document.documentElement.dataset.appScrollLock
    }
  }, [])
}

export function AppFrame({
  badges,
  nav,
  children,
  viewKey,
  direction = 1,
  showThemeToggle = true,
  hideThemeToggle = false,
  pendingThemeToggle = false,
  heroBand = false,
}: {
  badges?: ReactNode
  nav?: ReactNode
  children: ReactNode
  viewKey: string
  direction?: 1 | -1
  showThemeToggle?: boolean
  hideThemeToggle?: boolean
  pendingThemeToggle?: boolean
  heroBand?: boolean
}) {
  useDocumentScrollLock()

  return (
    <div
      className={cn(
        'mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-background',
        heroBand && '[--brand-band-tint:var(--hero-band)]',
      )}
    >
      <BrandBand control={showThemeToggle ? <ThemeToggle hidden={hideThemeToggle} /> : null}>
        {badges}
      </BrandBand>
      <div className="app-scroll flex flex-col">
        <main
          className={cn(
            'pt-content-inset px-content flex flex-1 flex-col [&>*]:flex-1',
            nav ? 'pb-nav-inset' : 'pb-content-inset',
          )}
        >
          <div
            key={viewKey}
            style={{ '--view-offset': `${24 * direction}px` } as CSSProperties}
            className="animate-view-slide view-slide-clip flex flex-1 flex-col [&>*]:flex-1"
          >
            {children}
          </div>
        </main>
      </div>
      {nav}
    </div>
  )
}
