'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

const BADGE_BOX = 'px-1.5 py-1 text-meta'
export const BADGE_SHAPE = `${BADGE_BOX} rounded-md`

export function MetaBadge({
  children,
  tone = 'muted',
  className,
}: {
  children: ReactNode
  className?: string
  tone?: 'muted' | 'accent'
}) {
  return (
    <span
      className={cn(
        BADGE_SHAPE,
        'inline-flex shrink-0 items-center font-medium tabular-nums',
        tone === 'accent'
          ? 'bg-primary/10 font-semibold text-primary'
          : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

