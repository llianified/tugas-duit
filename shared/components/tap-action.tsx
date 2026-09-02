'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { GlyphChevron } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

type TapActionTone = 'primary' | 'neutral'

const TONE_CLASS = {
  primary: [
    'btn-glass bg-primary text-primary-foreground',
    'hover:bg-primary-hover active:bg-primary-active',
  ].join(' '),
  neutral: [
    'btn-glass-quiet text-foreground',
    'hover:bg-foreground/[0.04] active:bg-foreground/[0.07]',
  ].join(' '),
} as const

const META_CLASS = {
  primary: 'text-primary-foreground/70',
  neutral: 'text-muted-foreground',
} as const

interface TapActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  meta?: ReactNode
  tone?: TapActionTone
  icon?: ReactNode
  /** Centered content without a trailing chevron, for buttons placed side by side. */
  compact?: boolean
}

export function TapAction({
  label,
  meta,
  tone = 'primary',
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
        'focus-ring transition-ui press-scale-soft group flex w-full items-center rounded-cta disabled:pointer-events-none',
        compact ? 'justify-center gap-2 px-3 text-center' : 'gap-3 px-4 text-left',
        'button-h',
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span
        className={cn(
          /* Tombol ini yang jadi kiblat ukuran label seluruh app; angkanya kini hidup di `--btn-label` lewat `.btn-label` supaya tombol lain mengikutinya dari satu tempat, bukan dari salinan 15px. */
          'btn-label truncate font-bold tracking-tight',
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
  compact = false,
}: {
  icon?: ReactNode
  label: string
  meta?: ReactNode
  className?: string
  tone?: TapActionTone
  compact?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'btn-label flex w-full items-center rounded-cta font-semibold text-muted-foreground',
        compact ? 'justify-center gap-2 px-3 text-center' : 'gap-3 px-4',
        'button-h',
        tone === 'neutral' ? 'ring-border' : 'bg-muted',
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span className={cn('truncate', compact ? 'min-w-0' : 'min-w-0 flex-1')}>{label}</span>
      {meta ? <span className="shrink-0 text-xs tabular-nums">{meta}</span> : null}
    </div>
  )
}
