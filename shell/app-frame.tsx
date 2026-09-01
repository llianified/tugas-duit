'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { BrandBand } from '@/shared/components/brand-band'
import { cn } from '@/shared/lib/utils'

function useDocumentScrollLock() {
  useEffect(() => {
    document.documentElement.dataset.appScrollLock = 'true'
    return () => {
      delete document.documentElement.dataset.appScrollLock
    }
  }, [])
}

/**
 * Layer toast dirender `ToastProvider`, di luar pohon frame ini, jadi ia tidak bisa
 * membaca ada-tidaknya nav lewat props. Penandanya dititipkan di `:root` supaya CSS
 * bisa mengangkat toast setinggi nav pill saat navnya ada, dan menempelkannya ke
 * inset bawah saat tidak (captcha, sesi gagal).
 */
function useDocumentNavFlag(hasNav: boolean) {
  useEffect(() => {
    if (!hasNav) return
    document.documentElement.dataset.appNav = 'true'
    return () => {
      delete document.documentElement.dataset.appNav
    }
  }, [hasNav])
}

export function AppFrame({
  badges,
  nav,
  children,
  viewKey,
  direction = 1,
  heroBand = false,
}: {
  badges?: ReactNode
  nav?: ReactNode
  children: ReactNode
  viewKey: string
  direction?: 1 | -1
  heroBand?: boolean
}) {
  useDocumentScrollLock()
  useDocumentNavFlag(Boolean(nav))

  return (
    <div
      className={cn(
        'mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-background',
        heroBand && '[--brand-band-tint:var(--hero-band)]',
      )}
    >
      <BrandBand>{badges}</BrandBand>
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
