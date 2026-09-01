'use client'

import type { ReactNode } from 'react'
import { IconCircle } from '@/shared/components/icon-circle'
import { MetaBadge } from '@/shared/components/meta-badge'
import { SectionLabel } from '@/shared/components/section-label'
import { cn } from '@/shared/lib/utils'

export function DataList({
  label,
  badge,
  action,
  children,
  ariaLabel,
}: {
  label: string
  badge?: ReactNode
  /**
   * Aksi opsional di kanan kepala daftar — tempat yang benar untuk "lihat
   * selengkapnya", karena ia menempel pada data yang dilanjutkannya alih-alih
   * berdiri sebagai tombol tersendiri di tempat lain. `badge` tetap didahulukan
   * agar ringkasan angka tidak terdorong keluar ketika keduanya dipakai.
   */
  action?: ReactNode
  children: ReactNode
  ariaLabel?: string
}) {
  return (
    <section aria-label={ariaLabel ?? label}>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel as="h2">{label}</SectionLabel>
        <span className="flex shrink-0 items-center gap-2">
          {badge ? <MetaBadge>{badge}</MetaBadge> : null}
          {action}
        </span>
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
        <p className="truncate text-[15px] font-semibold tracking-tight">{title}</p>
        {meta ? <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{meta}</p> : null}
        {note ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{note}</p>
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
        'text-[15px] font-bold tabular-nums',
        tone === 'primary' ? 'text-primary' : 'text-foreground',
      )}
    >
      {value} <span className="text-[13px] font-semibold text-muted-foreground">credit</span>
    </span>
  )
}
