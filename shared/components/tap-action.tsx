'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { GlyphChevron } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

type TapActionTone = 'primary' | 'neutral'
type TapActionSize = 'cta' | 'control'

const TONE_CLASS = {
  primary: [
    'tap-plate bg-primary text-primary-foreground',
    'hover:bg-primary-hover active:bg-primary-active',
  ].join(' '),
  neutral: [
    'border border-border bg-transparent text-foreground',
    'hover:bg-foreground/[0.04] active:bg-foreground/[0.07]',
  ].join(' '),
} as const

const META_CLASS = {
  primary: 'text-primary-foreground/70',
  neutral: 'text-muted-foreground',
} as const

const SIZE_CLASS = {
  cta: 'cta-h',
  control: 'control-h',
} as const

interface TapActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  meta?: ReactNode
  tone?: TapActionTone
  size?: TapActionSize
  icon?: ReactNode
  /** Centered content without a trailing chevron, for buttons placed side by side. */
  compact?: boolean
}

export function TapAction({
  label,
  meta,
  tone = 'primary',
  size = 'cta',
  icon,
  compact = false,
  className,
  ...props
}: TapActionProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'focus-ring transition-ui press-scale-soft group flex w-full items-center rounded-xl disabled:pointer-events-none',
        compact ? 'justify-center gap-2 px-3 text-center' : 'gap-3 px-4 text-left',
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span
        className={cn(
          'truncate text-sm font-semibold tracking-tight',
          compact ? 'min-w-0' : 'min-w-0 flex-1',
        )}
      >
        {label}
      </span>
      {meta ? (
        <span className={cn('shrink-0 text-xs font-medium tabular-nums', META_CLASS[tone])}>
          {meta}
        </span>
      ) : null}
      {compact ? null : (
        <GlyphChevron
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-active:translate-x-0',
            tone === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        />
      )}
    </button>
  )
}

export function TapActionWaiting({
  icon,
  label,
  meta,
  className,
  tone = 'primary',
  size = 'cta',
  compact = false,
}: {
  icon?: ReactNode
  label: string
  meta?: ReactNode
  className?: string
  tone?: TapActionTone
  size?: TapActionSize
  compact?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex w-full items-center rounded-xl text-sm font-medium text-muted-foreground',
        compact ? 'justify-center gap-2 px-3 text-center' : 'gap-3 px-4',
        SIZE_CLASS[size],
        tone === 'neutral' ? 'border border-border' : 'bg-muted',
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span className={cn('truncate', compact ? 'min-w-0' : 'min-w-0 flex-1')}>{label}</span>
      {meta ? <span className="shrink-0 text-xs tabular-nums">{meta}</span> : null}
    </div>
  )
}
