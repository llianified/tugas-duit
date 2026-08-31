'use client'

import type { ReactNode } from 'react'
import { IconCircle } from '@/shared/components/icon-circle'
import { MetaBadge } from '@/shared/components/meta-badge'
import { SectionLabel } from '@/shared/components/section-label'
import { cn } from '@/shared/lib/utils'

export function DataList({
  label,
  badge,
  children,
  ariaLabel,
}: {
  label: string
  badge?: ReactNode
  children: ReactNode
  ariaLabel?: string
}) {
  return (
    <section aria-label={ariaLabel ?? label}>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel as="h2">{label}</SectionLabel>
        {badge ? <MetaBadge>{badge}</MetaBadge> : null}
      </div>

      <ul className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
        {children}
      </ul>
    </section>
  )
}

export function DataListRow({
  marker,
  title,
  meta,
  note,
  amount,
  showDivider,
}: {
  marker?: ReactNode
  title: ReactNode
  meta?: ReactNode
  note?: ReactNode
  amount?: ReactNode
  showDivider: boolean
}) {
  return (
    <li
      className={cn(
        'bleed-x transition-ui flex gap-3 py-[var(--list-row-py)] hover:bg-muted/60',
        note ? 'items-start' : 'items-center',
        showDivider && 'border-b border-border/60',
      )}
    >
      {marker}

      <div className="min-w-0 flex-1">
        <p className="truncate text-cta font-bold tracking-[-0.01em]">{title}</p>
        {meta ? (
          <p className="truncate text-meta leading-snug text-muted-foreground">{meta}</p>
        ) : null}
        {note ? (
          <p className="mt-1 text-meta leading-relaxed text-muted-foreground">{note}</p>
        ) : null}
      </div>

      {amount ? <span className="flex shrink-0 flex-col items-end gap-1">{amount}</span> : null}
    </li>
  )
}

export function DataListMarker({
  tone = 'muted',
  children,
}: {
  tone?: 'muted' | 'primary' | 'success'
  children: ReactNode
}) {
  return (
    <IconCircle
      aria-hidden="true"
      size="sm"
      tone={tone === 'muted' ? 'muted' : tone === 'primary' ? 'primary' : 'success'}
      className="font-semibold"
    >
      {children}
    </IconCircle>
  )
}

export function DataListAmount({
  value,
  tone = 'primary',
}: {
  value: string
  tone?: 'primary' | 'neutral'
}) {
  return (
    <span
      className={cn(
        'text-cta font-bold tabular-nums',
        tone === 'primary' ? 'text-primary' : 'text-foreground',
      )}
    >
      {value} <span className="text-label font-semibold text-muted-foreground">credit</span>
    </span>
  )
}
