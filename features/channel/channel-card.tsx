'use client'

import { creditsToRupiah } from '@/domain/economy'
import { useChannelBonus } from '@/features/channel/use-channel-bonus'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphTelegram } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { SURFACE_CARD_CLASS } from '@/shared/components/surface-card'
import type { ChannelBonusState } from '@/shell/session-api'
import { formatCredits, formatRupiah } from '@/shared/lib/format'

/**
 * Kartu ini tidak lagi menjaga dirinya sendiri: syarat "bonusnya masih ada" hidup di
 * `channelBonusReachable`, dipanggil oleh `HomeView` yang juga memakai jawabannya untuk
 * memutuskan jarak antar kartu. Kartu yang mengembalikan `null` sendiri berarti aturan
 * yang sama tertulis di dua lapisan, dan lapisan yang di atas yang menyisakan jaraknya.
 */
export function ChannelBonusCard({
  bonus,
  onClaimed,
}: {
  bonus: ChannelBonusState
  onClaimed: () => Promise<unknown>
}) {
  const { claiming, claim } = useChannelBonus({ onClaimed })

  return (
    <section aria-label="Bonus join channel" className={SURFACE_CARD_CLASS}>
      <div className="flex items-center gap-2">
        <IconCircle size="sm" tone="primary">
          <GlyphTelegram className="size-4" />
        </IconCircle>
        <p className="text-sm font-semibold leading-none text-foreground">Bonus join channel</p>
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-primary">
          +{formatCredits(bonus.credits)} credit
        </span>
      </div>

      <p className="stack-gap-t text-xs leading-snug text-muted-foreground">
        Sekali seumur akun, langsung masuk saldo{' '}
        {formatRupiah(creditsToRupiah(bonus.credits))}.
      </p>

      <div className="stack-gap-t flex gap-2">
        {/* Ukuran labelnya mengikuti `ActionButton` (17px, tracking-tight) — bukan
            15px seperti tile hero — karena tombol ini berdiri sebaris dengan
            "Klaim bonus" yang memakai komponen itu. Dua ukuran huruf dalam satu
            baris terbaca sebagai salah satunya lebih penting, padahal sederajat. */}
        <a
          href={bonus.url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring transition-ui press-scale-soft control-h flex flex-1 items-center justify-center gap-2 rounded-cta btn-glass-quiet text-[17px] font-bold tracking-tight text-foreground"
        >
          Buka channel
        </a>
        <ActionButton className="flex-1" onClick={claim} disabled={claiming}>
          {claiming ? 'Mengecek…' : 'Klaim bonus'}
        </ActionButton>
      </div>
    </section>
  )
}
