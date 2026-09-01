'use client'

import { useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { CreditAmount } from '@/shared/components/credit-amount'
import { GlyphHistory } from '@/shared/components/glyph'
import { InfoHint } from '@/shared/components/info-hint'
import type { HistoryEntry } from '@/features/captcha/domain'
import { creditsToRupiah } from '@/domain/economy'
import {
  HERO_COMPACT_FROM,
  formatCompact,
  formatRupiahCompact,
  isSameWibDay,
} from '@/shared/lib/format'
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
      {/* Saldo dan aksinya berdiri sebaris, bukan bertumpuk.
          Sebelumnya angka memakan satu baris penuh lalu dua tile sederajat
          ("Tarik dana" + "Riwayat") memakan baris lagi di bawahnya — dua tombol
          selebar itu membuat keduanya terbaca sama penting, padahal cuma menarik
          dana yang memindahkan uang. Sekarang penarikan jadi satu CTA tunggal di
          kanan saldo, dan Riwayat turun jadi tombol ikon: ia tetap satu tap,
          tapi tidak lagi bersaing dengan CTA-nya. */}
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <div className="flex">
            <CreditAmount
              value={formatCompact(displayedBalance, { from: HERO_COMPACT_FROM })}
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
            {formatRupiahCompact(creditsToRupiah(displayedBalance), { from: HERO_COMPACT_FROM })}
            <span aria-hidden> · </span>
            {/* Hijau hanya kalau memang ada penambahan nyata hari ini; nol tetap diredam. */}
            <span className={earnedToday > 0 ? 'text-success' : undefined}>
              +{formatCompact(earnedToday, { from: HERO_COMPACT_FROM })} hari ini
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <HeroIconButton
            label="Riwayat"
            onClick={onHistory}
            icon={<GlyphHistory className="size-5" />}
          />
          <ActionButton className="w-auto px-5" onClick={onWithdraw}>
            Tarik dana
          </ActionButton>
        </div>
      </div>
    </section>
  )
}

/**
 * Tombol ikon tanpa teks: bentuknya persegi setinggi kontrol lain, memakai
 * permukaan gelas tenang yang sama supaya terbaca satu keluarga dengan CTA di
 * sebelahnya — hanya berbeda derajat, bukan berbeda jenis. Namanya tetap ada
 * sebagai `aria-label` dan `title`, jadi maknanya tidak bergantung pada ikon saja.
 */
function HeroIconButton({
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
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        'focus-ring transition-ui press-scale-soft control-h flex aspect-square shrink-0 items-center justify-center rounded-cta',
        'btn-glass-quiet text-muted-foreground hover:text-foreground active:text-foreground',
      )}
    >
      {icon}
    </button>
  )
}
