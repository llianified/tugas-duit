'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** Dasar chip padat gaya fomo: radius `--chip-radius`, padding ketat, teks 0.6875rem/700. Diekspor supaya elemen yang bukan `MetaBadge` (mis. `DifficultyBadge`) tetap memakai geometri yang sama. */
export const CHIP_SHAPE = 'chip'

export type ChipTone = 'muted' | 'neutral' | 'primary' | 'success' | 'destructive' | 'premium'

const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  muted: 'chip-muted',
  neutral: 'chip-neutral',
  primary: 'chip-primary',
  success: 'chip-success',
  destructive: 'chip-destructive',
  premium: 'chip-premium',
}

export function MetaBadge({
  children,
  tone = 'muted',
  className,
  title,
}: {
  children: ReactNode
  className?: string
  tone?: ChipTone
  /** Penjelasan panjang saat chip-nya sendiri terlalu pendek (mis. lencana prestise di papan peringkat). */
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(CHIP_SHAPE, 'shrink-0 tabular-nums', CHIP_TONE_CLASS[tone], className)}
    >
      {children}
    </span>
  )
}
