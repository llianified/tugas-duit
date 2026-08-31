'use client'

import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { actionButtonClass } from '@/shared/components/action-button'
import { CreditAmount } from '@/shared/components/credit-amount'
import { GlyphHistory, GlyphWithdraw } from '@/shared/components/glyph'
import { InfoHint } from '@/shared/components/info-hint'
import { creditsToRupiah } from '@/domain/economy'
import { formatCredits, formatRupiah } from '@/shared/lib/format'
import { useCountUp } from '@/shared/lib/use-count-up'

export function BalanceSummary({
  balance,
  onWithdraw,
  onHistory,
}: {
  balance: number
  onWithdraw: () => void
  onHistory: () => void
}) {
  const displayedBalance = useCountUp(balance)

  return (
    <section aria-label="Saldo reward">
      <div className="relative">
        <div className="flex">
          <CreditAmount
            value={formatCredits(displayedBalance)}
            size="2xl"
            tone="neutral"
            hint={
              <InfoHint label="Saldo reward">
                Credit yang kamu punya sekarang. Penarikan yang masih diproses sudah dipotong dari
                angka ini, jadi segini persis yang bisa kamu tarik ke e-wallet atau rekening bank
                begitu jumlahnya cukup.
              </InfoHint>
            }
          />
        </div>
        <p
          data-hint-tail
          className="stack-gap-t text-sm leading-none tabular-nums text-muted-foreground"
        >
          {formatRupiah(creditsToRupiah(displayedBalance))}
        </p>
      </div>

      <BalanceActions onWithdraw={onWithdraw} onHistory={onHistory} />
    </section>
  )
}

function HeroActionTile({
  icon,
  label,
  ...props
}: {
  icon: ReactNode
  label: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={actionButtonClass({ variant: 'soft', className: 'flex-1 px-3' })}
    >
      {icon}
      <span className="whitespace-nowrap leading-none">{label}</span>
    </button>
  )
}

function BalanceActions({
  onWithdraw,
  onHistory,
}: {
  onWithdraw: () => void
  onHistory: () => void
}) {
  return (
    <div className="mt-[var(--region-gap)] flex gap-2">
      <HeroActionTile
        label="Tarik dana"
        onClick={onWithdraw}
        icon={
          <GlyphWithdraw className="glyph-lg" />
        }
      />

      <HeroActionTile
        label="Riwayat"
        onClick={onHistory}
        icon={<GlyphHistory className="glyph-lg" />}
      />
    </div>
  )
}
