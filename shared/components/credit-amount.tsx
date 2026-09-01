'use client'

import type { ReactNode } from 'react'
import { splitAmountParts } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const CREDIT_SIZE_CLASS = {
  sm: 'flex-row items-baseline gap-1 text-sm font-semibold',
  xl: 'flex-col items-stretch gap-1.5 text-4xl font-bold leading-none tracking-[-0.03em]',
  '2xl': 'flex-row flex-wrap items-baseline gap-x-2 text-5xl font-bold leading-none tracking-[-0.035em]',
  display: 'num-display flex-row flex-wrap items-baseline gap-x-1.5 text-[3rem]',
} as const

const CREDIT_STACKED = { sm: false, xl: true, '2xl': false, display: false } as const

const CREDIT_UNIT_CLASS = {
  sm: 'text-xs font-medium',
  xl: 'text-sm font-medium',
  '2xl': 'text-sm font-semibold',
  display: 'text-[0.6em] font-extrabold',
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
  size?: 'sm' | 'xl' | '2xl' | 'display'
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
      {size === 'display' ? (
        <DisplayValue prefix={prefix} value={value} />
      ) : CREDIT_STACKED[size] ? (
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

/**
 * Angka besar gaya fomo: bagian bulatnya penuh terang, sisanya diredam.
 *
 * Yang diredam hanya tanda/simbol di depan dan desimal di belakang — bukan
 * pemisah ribuan, karena di format Indonesia titik itu bagian dari bilangan
 * bulat. Kalau nilainya bulat, tidak ada `,00` yang dipaksa muncul; bagian
 * `trail` cuma kosong.
 */
function DisplayValue({ prefix, value }: { prefix?: string; value: string }) {
  const { lead, main, trail } = splitAmountParts(`${prefix ?? ''}${value}`)

  return (
    <span>
      {lead ? <span className="text-[0.6em] text-muted-foreground">{lead}</span> : null}
      {main}
      {trail ? <span className="text-[0.6em] text-muted-foreground">{trail}</span> : null}
    </span>
  )
}
