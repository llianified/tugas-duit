'use client'

import type { ReactNode } from 'react'
import { useIslandDismiss, useIslandGeometry } from '@/features/home/use-island-geometry'
import { hapticTap } from '@/shell/haptic'
import { cn } from '@/shared/lib/utils'

const ISLAND_PILL_BOX = 'h-[var(--brand-pill-h)] px-3 text-[11px] leading-none'

const ISLAND_PILL_RADIUS = 'rounded-[calc(var(--brand-pill-h)/2)]'

export function IslandDivider() {
  return <div aria-hidden="true" className="h-px bg-border" />
}

const ISLAND_VALUE_TONE = {
  foreground: 'text-foreground',
  primary: 'text-primary',
  success: 'text-success',
  muted: 'text-muted-foreground',
} as const

/**
 * Satu ritme baris untuk seluruh panel island: label 11px di kiri, nilai 12px
 * semibold di kanan, meter opsional di bawahnya. Semua region memakai ini agar
 * tinggi, padding, dan tipografinya presisi sama.
 */
export function IslandStat({
  label,
  value,
  tone = 'foreground',
  meter,
  footer,
}: {
  label: ReactNode
  value?: ReactNode
  tone?: keyof typeof ISLAND_VALUE_TONE
  meter?: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="island-region">
      <div className="island-row flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[11px] leading-none text-muted-foreground tabular-nums">
          {label}
        </span>
        {value ? (
          <span
            className={cn(
              'shrink-0 text-xs leading-none font-semibold tracking-tight tabular-nums',
              ISLAND_VALUE_TONE[tone],
            )}
          >
            {value}
          </span>
        ) : null}
      </div>
      {meter ? <div className="island-row">{meter}</div> : null}
      {footer ? <div className="island-row">{footer}</div> : null}
    </div>
  )
}

export function IslandPill({
  panelId,
  pillLabel,
  pillTitle,
  openLabel,
  closeLabel,
  srSummary,
  isOpen,
  slideOutTo,
  onToggle,
  onClose,
  className,
  pillClassName,
  children,
}: {
  panelId: string
  pillLabel: ReactNode
  pillTitle: string
  openLabel: string
  closeLabel: string
  srSummary?: ReactNode
  isOpen: boolean
  slideOutTo?: 'left' | 'right'
  onToggle: () => void
  onClose: () => void
  className?: string
  pillClassName?: string
  children: ReactNode
}) {
  const { islandRef, contentRef } = useIslandGeometry()

  useIslandDismiss({ isOpen, islandRef, onClose })

  return (
    <div
      ref={islandRef}
      data-island={isOpen ? 'open' : 'closed'}
      data-island-aside={slideOutTo}
      className={cn('island', className)}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? closeLabel : openLabel}
        title={pillTitle}
        onClick={() => {
          hapticTap()
          onToggle()
        }}
        tabIndex={slideOutTo ? -1 : undefined}
        aria-hidden={slideOutTo ? true : undefined}
        className={cn(
          ISLAND_PILL_BOX,
          ISLAND_PILL_RADIUS,
          "island-pill relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap border border-border bg-muted font-semibold outline-none after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
          pillClassName,
        )}
      >
        {pillLabel}
        {isOpen || !srSummary ? null : <span className="sr-only">{srSummary}</span>}
      </button>

      <div
        className="island-panel box-content overflow-hidden border border-border bg-muted"
        onClick={onClose}
      >
        <div ref={contentRef} id={panelId} aria-hidden={!isOpen} className="island-panel-content">
          {children}
        </div>
      </div>
    </div>
  )
}
