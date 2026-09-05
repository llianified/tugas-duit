'use client'

import type { ReactNode } from 'react'
import { CreditAmount } from '@/shared/components/credit-amount'
import { InfoHint } from '@/shared/components/info-hint'
import { SectionLabel } from '@/shared/components/section-label'
import { creditsToRupiah } from '@/domain/economy/economy'
import { formatCreditsPrecise, formatRupiah } from '@/shared/lib/format'

export function TotalSummary({
  label,
  credits,
  hint,
  note,
  ariaLabel,
  className,
}: {
  label: string
  credits: number
  hint?: ReactNode
  note?: ReactNode
  ariaLabel?: string
  className?: string
}) {
  return (
    <section aria-label={ariaLabel ?? label} className={className}>
      <SectionLabel as="h2">{label}</SectionLabel>

      <div className="label-gap-t relative">
        <div className="flex">
          <CreditAmount
            value={formatCreditsPrecise(credits)}
            size="2xl"
            tone="neutral"
            hint={hint ? <InfoHint label={label}>{hint}</InfoHint> : undefined}
          />
        </div>

        <p
          data-hint-tail
          className="stack-gap-t text-sm leading-none tabular-nums text-muted-foreground"
        >
          {formatRupiah(creditsToRupiah(credits))}
        </p>
      </div>

      {/* `div`, bukan `p`: catatan ini sekarang boleh membawa meter, dan `div` di dalam `p`
          adalah HTML tak sah yang dipecahkan peramban sendiri saat parsing — hidrasi React lalu
          menemukan pohon yang berbeda dari yang dirender server. */}
      {note ? (
        <div className="label-gap-t text-[13px] leading-relaxed text-muted-foreground text-pretty">
          {note}
        </div>
      ) : null}
    </section>
  )
}
