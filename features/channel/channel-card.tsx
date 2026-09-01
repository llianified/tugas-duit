'use client'

import { creditsToRupiah } from '@/domain/economy'
import { useChannelBonus } from '@/features/channel/use-channel-bonus'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphTelegram } from '@/shared/components/glyph'
import type { ChannelBonusState } from '@/shell/session-api'
import { formatCredits, formatRupiah } from '@/shared/lib/format'

/**
 * Kartu ini tidak lagi menjaga dirinya sendiri: syarat "bonusnya masih ada" hidup di
 * `channelBonusReachable`, dipanggil oleh `HomeView` yang juga memakai jawabannya untuk
 * memutuskan jarak antar kartu. Kartu yang mengembalikan `null` sendiri berarti aturan
 * yang sama tertulis di dua lapisan, dan lapisan yang di atas yang menyisakan jaraknya.
 *
 * Bentuknya kupon dengan stub yang disobek (lihat `.bonus-coupon` di globals.css).
 * Alasannya bukan selera: ini satu-satunya kartu di beranda yang bisa HILANG kalau
 * diabaikan, dan sebagai pelat rata ia terbaca sederajat dengan daftar transaksi yang
 * tidak ke mana-mana. Kupon punya arah — ada yang disobek, dan sobekannya sekali.
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
    <section aria-label="Bonus join channel" className="bonus-coupon">
      <div className="bonus-coupon-stub" aria-hidden="true">
        <span className="bonus-coupon-stub-label">Kupon</span>
      </div>

      <div className="relative min-w-0 flex-1 p-[var(--surface-p)]">
        {/* `GlyphSvg` sudah menyetel `aria-hidden` sendiri, jadi tidak diulang. */}
        <GlyphTelegram className="bonus-coupon-plane" />

        <div className="relative flex items-baseline gap-1.5">
          <p className="num-display text-[1.75rem] text-primary">
            +{formatCredits(bonus.credits)}
          </p>
          <p className="home-tag pb-0.5">credit</p>
        </div>

        <p className="relative stack-gap-t text-xs leading-snug text-muted-foreground">
          Bonus join channel · cair {formatRupiah(creditsToRupiah(bonus.credits))} ke saldo,
          sekali seumur akun.
        </p>

        {/* Dua tombol berbagi satu baris, dan keduanya memakai `--btn-label` seperti
            "Mulai" di karcis. Yang membedakan derajatnya bidangnya — tenang vs aksen —
            bukan ukuran hurufnya. */}
        <div className="stack-gap-t flex gap-2">
          <a
            href={bonus.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buka channel Telegram di tab baru"
            className="focus-ring transition-ui press-scale-soft control-h-sm btn-label flex flex-1 items-center justify-center gap-1.5 rounded-cta btn-glass-quiet font-bold tracking-tight text-foreground"
          >
            <GlyphTelegram className="size-4 shrink-0" />
            Buka
          </a>
          <ActionButton
            size="sm"
            className="flex-[1.6]"
            onClick={claim}
            disabled={claiming}
          >
            {claiming ? 'Mengecek…' : 'Klaim bonus'}
          </ActionButton>
        </div>
      </div>
    </section>
  )
}
