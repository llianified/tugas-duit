'use client'

import { useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { CreditAmount } from '@/shared/components/credit-amount'
import { GlyphHistory, GlyphWithdraw } from '@/shared/components/glyph'
import { InfoHint } from '@/shared/components/info-hint'
import type { HistoryEntry } from '@/features/captcha/domain'
import { creditsToRupiah } from '@/domain/economy'
import { formatCredits, formatRupiah, isSameWibDay } from '@/shared/lib/format'
import { useCountUp } from '@/shared/lib/use-count-up'
import { cn } from '@/shared/lib/utils'

export function BalanceSummary({
  balance,
  history,
  onWithdraw,
  onHistory,
}: {
  balance: number
  history: HistoryEntry[]
  onWithdraw: () => void
  onHistory: () => void
}) {
  const displayedBalance = useCountUp(balance)

  /**
   * "Hari ini" di sini adalah hari WIB, bukan hari perangkat — sama seperti
   * label waktu di riwayat, supaya angka ini tidak pernah berbeda dari daftar
   * yang menjadi sumbernya hanya karena zona ponsel pengguna.
   */
  const earnedToday = useMemo(
    () =>
      history.reduce((total, entry) => 
        (isSameWibDay(entry.completedAt) ? total + entry.reward : total), 0),
    [history],
  )

  return (
    <section aria-label="Saldo reward">
      <div className="relative">
        <div className="flex">
          <CreditAmount
            value={formatCredits(displayedBalance)}
            size="display"
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
          <span aria-hidden> · </span>
          {/* Hijau hanya kalau memang ada penambahan nyata hari ini; nol tetap diredam. */}
          <span className={earnedToday > 0 ? 'text-success' : undefined}>
            +{formatCredits(earnedToday)} hari ini
          </span>
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
      className={cn(
        'focus-ring transition-ui press-scale-soft control-h flex flex-1 items-center justify-center gap-2 rounded-cta px-3',
        // Hairline gelas yang sama dengan tombol lain: ring 1px --border di
        // dalam, bukan border asli, supaya semua permukaan terbaca satu keluarga.
        'btn-glass-quiet text-foreground',
      )}
    >
      {icon}
      <span className="whitespace-nowrap text-[15px] font-bold tracking-tight leading-none">{label}</span>
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
          <GlyphWithdraw className="size-5" />
        }
      />

      <HeroActionTile
        label="Riwayat"
        onClick={onHistory}
        icon={<GlyphHistory className="size-5" />}
      />
    </div>
  )
}
