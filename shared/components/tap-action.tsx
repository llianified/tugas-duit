'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { GlyphChevron } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

type TapActionTone = 'primary' | 'neutral'

const TONE_CLASS = {
  primary: [
    'tap-plate cta-h bg-primary text-primary-foreground',
    'hover:bg-primary-hover active:bg-primary-active',
  ].join(' '),
  neutral: ['control-h bg-muted text-foreground', 'hover:bg-muted-foreground/15'].join(' '),
} as const

const CHIP_CLASS = {
  primary: 'bg-primary-foreground/20 text-primary-foreground',
  neutral: 'bg-foreground/10 text-foreground',
} as const

const META_CLASS = {
  primary: 'text-primary-foreground/75',
  neutral: 'text-muted-foreground',
} as const

interface TapActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  meta?: ReactNode
  tone?: TapActionTone
  icon?: ReactNode
}

export function TapAction({
  label,
  meta,
  tone = 'primary',
  icon,
  className,
  ...props
}: TapActionProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'focus-ring transition-ui press-scale-soft group flex w-full items-center gap-3 rounded-xl px-4 text-left disabled:pointer-events-none',
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">{label}</span>
      {meta ? (
        <span className={cn('shrink-0 text-xs font-medium tabular-nums', META_CLASS[tone])}>
          {meta}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-active:translate-x-0',
          CHIP_CLASS[tone],
        )}
      >
        <GlyphChevron className="size-4" />
      </span>
    </button>
  )
}

export function TapActionWaiting({
  icon,
  label,
  meta,
  className,
  compact = false,
}: {
  icon?: ReactNode
  label: string
  meta?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex w-full items-center gap-3 rounded-xl bg-muted px-4 text-sm font-medium text-muted-foreground',
        compact ? 'control-h' : 'cta-h',
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? <span className="shrink-0 text-xs tabular-nums">{meta}</span> : null}
    </div>
  )
}
