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
}

export function TapAction({
  label,
  meta,
  tone = 'primary',
  size = 'cta',
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
        SIZE_CLASS[size],
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
      {tone === 'primary' ? (
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/20 text-primary-foreground transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-active:translate-x-0"
        >
          <GlyphChevron className="size-4" />
        </span>
      ) : (
        <GlyphChevron
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-active:translate-x-0"
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
}: {
  icon?: ReactNode
  label: string
  meta?: ReactNode
  className?: string
  tone?: TapActionTone
  size?: TapActionSize
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-4 text-sm font-medium text-muted-foreground',
        SIZE_CLASS[size],
        tone === 'neutral' ? 'border border-border' : 'bg-muted',
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? <span className="shrink-0 text-xs tabular-nums">{meta}</span> : null}
    </div>
  )
}
