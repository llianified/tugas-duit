'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export const EYEBROW_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground'

export function SectionLabel({
  as: Element = 'p',
  children,
  className,
}: {
  as?: 'p' | 'h2' | 'h3'
  children: ReactNode
  className?: string
}) {
  return (
    <Element
      className={cn(EYEBROW_CLASS, className)}
    >
      {children}
    </Element>
  )
}
