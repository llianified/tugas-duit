'use client'

import type { ReactNode } from 'react'
import { IconCircle } from '@/shared/components/icon-circle'

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <IconCircle tone="card">{icon}</IconCircle>

      <p className="label-gap-t text-base font-semibold tracking-tight">{title}</p>
      <p className="stack-gap-t max-w-[15rem] text-sm leading-relaxed text-muted-foreground text-pretty">
        {description}
      </p>
    </div>
  )
}
