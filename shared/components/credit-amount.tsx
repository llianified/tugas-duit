'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

const CREDIT_SIZE_CLASS = {
  sm: 'flex-row items-baseline gap-1 text-sm font-semibold',
  xl: 'flex-col items-stretch gap-1.5 text-4xl font-bold leading-none tracking-[-0.03em]',
  '2xl': 'flex-row flex-wrap items-baseline gap-x-2 text-5xl font-bold leading-none tracking-[-0.035em]',
} as const

const CREDIT_STACKED = { sm: false, xl: true, '2xl': false } as const

const CREDIT_UNIT_CLASS = {
  sm: 'text-xs font-medium',
  xl: 'text-sm font-medium',
  '2xl': 'text-sm font-semibold',
} as const

export function CreditAmount({
  value,
  prefix,
  unit = 'credit',
  hint,
  size = 'sm',
  tone = 'primary',
  className,
}: {
  value: string
  prefix?: string
  unit?: string
  hint?: ReactNode
  size?: 'sm' | 'xl' | '2xl'
  tone?: 'primary' | 'neutral'
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex tabular-nums',
        tone === 'primary' ? 'text-primary' : 'text-foreground',
        CREDIT_SIZE_CLASS[size],
        className,
      )}
    >
      {CREDIT_STACKED[size] ? (
        <span>
          {prefix}
          {value}
        </span>
      ) : (
        <>
          {prefix}
          {value}{' '}
        </>
      )}
      <span className={cn(CREDIT_UNIT_CLASS[size], 'tracking-normal text-muted-foreground')}>
        {unit}
        {hint}
      </span>
    </span>
  )
}

