'use client'

import { GlyphWallet } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { Surface } from '@/shared/components/surface'
import {
  creditsToRupiah,
  firstWithdrawalEstimateDays,
  withdrawalMinimumCredits,
} from '@/domain/economy'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'

export function NotEligibleNote({
  reason = 'balance',
  activeReferralCount = 0,
  requiredActiveReferrals = 5,
  cooldownEndsAt = null,
}: {
  reason?: 'balance' | 'referrals' | 'cooldown'
  activeReferralCount?: number
  requiredActiveReferrals?: number
  cooldownEndsAt?: number | null
}) {
  const title = reason === 'balance' ? 'Belum bisa ditarik' : reason === 'referrals' ? 'Referral belum cukup' : 'Masih cooldown'

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
            penarikannya kebuka. Dengan plafon dasar harian, penarikan pertama bisa tercapai sekitar{' '}
            {firstWithdrawalEstimateDays()} hari aktif; bonus rank dan streak bisa mempercepatnya.
          </>
        ) : reason === 'referrals' ? (
          <>
            Kamu punya {formatCredits(activeReferralCount)} dari {formatCredits(requiredActiveReferrals)}{' '}
            referral aktif. Ajak teman menyelesaikan minimal 1 task agar dihitung aktif.
          </>
        ) : (
          <>
            Kamu bisa tarik dana lagi {cooldownEndsAt ? formatHistoryTime(cooldownEndsAt) : 'setelah cooldown selesai'}. Cooldown berlangsung 7 hari sejak pengajuan terakhir, termasuk jika ditolak.
          </>
        )}
      </p>
    </Surface>
  )
}
