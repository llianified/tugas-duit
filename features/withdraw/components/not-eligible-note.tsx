'use client'

import { GlyphWallet } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { Surface } from '@/shared/components/surface'
import {
  creditsToRupiah,
  firstWithdrawalEstimateDays,
  withdrawalMinimumCredits,
} from '@/domain/economy'
import { formatRupiah } from '@/shared/lib/format'

export function NotEligibleNote() {
  return (
    <Surface as="section" aria-label="Saldo belum bisa ditarik">
      <div className="flex items-center gap-3">
        <IconCircle tone="card">
          <GlyphWallet className="glyph-md" />
        </IconCircle>
        <p className="min-w-0 text-sm font-semibold tracking-tight">Belum bisa ditarik</p>
      </div>

      <p className="stack-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">
        Nabung dulu sampai {formatRupiah(creditsToRupiah(withdrawalMinimumCredits()))} ya, baru
        penarikannya kebuka. Dengan plafon dasar harian, penarikan pertama bisa tercapai sekitar{' '}
        {firstWithdrawalEstimateDays()} hari aktif; bonus rank dan streak bisa mempercepatnya.
      </p>
    </Surface>
  )
}
