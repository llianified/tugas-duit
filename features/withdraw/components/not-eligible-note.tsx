'use client'

import { GlyphWallet } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { Surface } from '@/shared/components/surface'
import {
  creditsToRupiah,
  firstWithdrawalEstimateDays,
  withdrawalMinimumCredits,
} from '@/domain/economy/economy'
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
  reason?: 'balance' | 'days' | 'referrals' | 'cooldown' | 'loading'
  activeReferralCount?: number
  requiredActiveReferrals?: number
  cooldownEndsAt?: number | null
  cooldownDays?: number | null
  activeDays?: number
  requiredActiveDays?: number
}) {
  const title =
    reason === 'balance'
      ? 'Belum bisa ditarik'
      : reason === 'loading'
        ? 'Lagi ngecek syaratnya'
        : reason === 'days'
          ? 'Hari aktifnya belum cukup'
          : reason === 'referrals'
            ? 'Referral belum cukup'
            : 'Masih cooldown'

  return (
    <Surface as="section" aria-label={title}>
      <div className="flex items-center gap-3">
        <IconCircle tone="card">
          <GlyphWallet className="glyph-md" />
        </IconCircle>
        <p className="min-w-0 text-sm font-semibold tracking-tight">{title}</p>
      </div>

      <p className="stack-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">
        {reason === 'balance' ? (
          <>
            Nabung dulu sampai {formatRupiah(creditsToRupiah(withdrawalMinimumCredits()))} ya, baru
            penarikannya kebuka. Dengan laju isi ulang stok reward sekarang, penarikan pertama
            biasanya kekejar sekitar {firstWithdrawalEstimateDays()} hari aktif — bonus rank sama
            streak bisa mempercepat.
          </>
        ) : reason === 'loading' ? (
          <>Bentar ya, kami lagi ngecek syarat penarikan kamu.</>
        ) : reason === 'days' ? (
          <>
            Kamu punya {formatCredits(activeDays)} dari {formatCredits(requiredActiveDays)} hari
            aktif. Satu hari kehitung aktif kalau ada minimal 1 task yang kelar — nggak harus
            berturut-turut, jadi bolong sehari nggak ngulang dari nol.
          </>
        ) : reason === 'referrals' ? (
          <>
            Kamu punya {formatCredits(activeReferralCount)} dari {formatCredits(requiredActiveReferrals)}{' '}
            referral aktif. Teman kamu baru kehitung aktif setelah dia ngerjain minimal 1 task.
          </>
        ) : (
          <>
            Kamu bisa tarik dana lagi {cooldownEndsAt ? formatHistoryTime(cooldownEndsAt) : 'setelah cooldown-nya kelar'}.{' '}
            {cooldownDays === null
              ? 'Cooldown-nya dihitung dari pengajuan terakhir'
              : `Cooldown-nya ${formatCredits(cooldownDays)} hari dihitung dari pengajuan terakhir`}{' '}
            — tetap jalan walau pengajuannya ditolak.
          </>
        )}
      </p>
    </Surface>
  )
}
