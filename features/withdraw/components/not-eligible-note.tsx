'use client'

import { GlyphWallet } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { Surface } from '@/shared/components/surface'
import {
  creditsToRupiah,
  firstWithdrawalEstimateDays,
  withdrawalMinimumCredits,
} from '@/domain/economy/economy'
import type { WithdrawalGatingReason } from '@/domain/economy/withdrawal'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'

export function NotEligibleNote({
  reason = 'balance',
  activeReferralCount = 0,
  requiredActiveReferrals = 5,
  cooldownEndsAt = null,
  cooldownDays = null,
  activeDays = 0,
  requiredActiveDays = 7,
}: {
  reason?: WithdrawalGatingReason
  activeReferralCount?: number
  requiredActiveReferrals?: number
  cooldownEndsAt?: number | null
  cooldownDays?: number | null
  activeDays?: number
  requiredActiveDays?: number
}) {
  const title =
    reason === 'processing'
      ? 'Masih diproses'
      : reason === 'balance'
        ? 'Belum bisa ditarik'
        : reason === 'loading'
          ? 'Lagi cek syarat'
          : reason === 'days'
            ? 'Hari aktif belum cukup'
            : reason === 'referrals'
              ? 'Referral belum cukup'
              : 'Masih kena jeda'

  return (
    <Surface as="section" aria-label={title}>
      <div className="flex items-center gap-3">
        <IconCircle tone="card">
          <GlyphWallet className="glyph-md" />
        </IconCircle>
        <p className="min-w-0 text-sm font-semibold tracking-tight">{title}</p>
      </div>

      <p className="stack-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">
        {reason === 'processing' ? (
          <>
            Pengajuan kamu yang sebelumnya masih diproses. Saldonya ditahan dulu, balik lagi kalau ditolak.
            Hasilnya kami kabari lewat bot.
          </>
        ) : reason === 'balance' ? (
          <>
            Kumpulkan saldo sampai {formatRupiah(creditsToRupiah(withdrawalMinimumCredits()))}.
            Biasanya butuh sekitar {firstWithdrawalEstimateDays()} hari aktif; bonus rank dan streak
            bisa mempercepat.
          </>
        ) : reason === 'loading' ? (
          <>Bentar, lagi cek syaratnya.</>
        ) : reason === 'days' ? (
          <>
            Kamu punya {formatCredits(activeDays)} dari {formatCredits(requiredActiveDays)} hari
            aktif. Satu hari kehitung kalau ada minimal 1 soal kelar. Nggak harus beruntun.
          </>
        ) : reason === 'referrals' ? (
          <>
            Kamu punya {formatCredits(activeReferralCount)} dari {formatCredits(requiredActiveReferrals)}{' '}
            teman aktif. Teman kehitung aktif setelah dia kelarin 1 soal.
          </>
        ) : (
          <>
            Bisa tarik lagi {cooldownEndsAt ? formatHistoryTime(cooldownEndsAt) : 'setelah jedanya kelar'}.{' '}
            {cooldownDays === null
              ? 'Dihitung sejak pengajuan terakhir'
              : `${formatCredits(cooldownDays)} hari sejak pengajuan terakhir`}{' '}
            dan tetap jalan meski ditolak.
          </>
        )}
      </p>
    </Surface>
  )
}
