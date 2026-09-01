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
 *
 * Isinya dirapatkan jadi tiga baris: nominal (dengan syarat "sekali seumur akun" ikut
 * di baris yang sama sebagai keterangan, bukan kalimat sendiri), satu kalimat cair, lalu
 * tombolnya. Versi sebelumnya memisah keduanya jadi dua paragraf, dan di layar 384px itu
 * satu baris tinggi yang tidak menambah satu pun informasi baru.
 */
export function ChannelBonusCard({
  bonus,
  onClaimed,
}: {
  bonus: ChannelBonusState
  onClaimed: () => Promise<unknown>
}) {
  const { claiming, torn, claim } = useChannelBonus({ onClaimed })

  return (
    <section
      aria-label="Bonus join channel"
      className={`bonus-coupon${torn ? ' bonus-coupon-tearing' : ''}`}
    >
      <div className="bonus-coupon-stub" aria-hidden="true">
        <span className="bonus-coupon-stub-label">Bonus</span>
      </div>

      <div className="bonus-coupon-body">
        {/* `GlyphSvg` sudah menyetel `aria-hidden` sendiri, jadi tidak diulang. */}
        <GlyphTelegram className="bonus-coupon-plane" />

        {/* Nominal dan syaratnya satu baris. "Sekali seumur akun" adalah keterangan
            dari angkanya, jadi ia duduk di garis dasar yang sama sebagai ekor baris —
            bukan paragraf sendiri yang menuntut tinggi barisnya. */}
        <div className="relative flex flex-wrap items-baseline gap-x-1.5">
          <p className="num-display text-[1.625rem] leading-none text-primary">
            +{formatCredits(bonus.credits)}
          </p>
          <p className="home-tag">credit</p>
          <p className="text-[11px] leading-none text-muted-foreground">
            · sekali seumur akun
          </p>
        </div>

        <p className="relative mt-1.5 text-xs leading-snug text-muted-foreground">
          Cair {formatRupiah(creditsToRupiah(bonus.credits))} ke saldo begitu kamu join
          channel.
        </p>

        {/* Dua tombol berbagi satu baris, dan keduanya memakai `--btn-label` seperti
            "Mulai" di karcis. Yang membedakan derajatnya bidangnya — tenang vs aksen —
            bukan ukuran hurufnya. */}
        <div className="relative mt-2.5 flex gap-2">
          <a
            href={bonus.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buka channel Telegram di tab baru"
            className="focus-ring transition-ui press-scale-soft control-h-sm btn-label flex flex-1 items-center justify-center gap-1.5 rounded-cta btn-glass-quiet font-bold tracking-tight text-foreground"
          >
            <GlyphTelegram className="size-4 shrink-0" />
            Join
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
