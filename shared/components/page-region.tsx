'use client'

import type { ReactNode } from 'react'
import { MetaBadge } from '@/shared/components/meta-badge'
import { SectionLabel } from '@/shared/components/section-label'
import { cn } from '@/shared/lib/utils'

export function PageRegion({
  label,
  badge,
  ariaLabel,
  children,
  className,
}: {
  label?: string
  badge?: ReactNode
  ariaLabel?: string
  children: ReactNode
  className?: string
}) {
  const content = (
    <>
      {label ? (
        <div className="flex items-center justify-between gap-3">
          <SectionLabel as="h2">{label}</SectionLabel>
          {badge ? <MetaBadge>{badge}</MetaBadge> : null}
        </div>
      ) : null}
      {children}
    </>
  )

  if (!label) {
    return <div className={cn('region-t', className)}>{content}</div>
  }

  return (
    <section aria-label={ariaLabel ?? label} className={cn('region-t', className)}>
      {content}
    </section>
  )
}
