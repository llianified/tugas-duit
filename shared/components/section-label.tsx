'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export const EYEBROW_CLASS = 'text-label font-medium tracking-tight text-muted-foreground'

export const PAGE_TITLE_CLASS = 'text-base font-semibold tracking-tight text-foreground'

export function SectionLabel({
  as: Element = 'p',
  children,
  className,
}: {
  as?: 'p' | 'h2' | 'h3'
  children: ReactNode
  className?: string
}) {
  return <Element className={cn(EYEBROW_CLASS, className)}>{children}</Element>
}

export function PageTitle({
  as: Element = 'h1',
  children,
  className,
}: {
  as?: 'h1' | 'h2'
  children: ReactNode
  className?: string
}) {
  return <Element className={cn(PAGE_TITLE_CLASS, className)}>{children}</Element>
}
