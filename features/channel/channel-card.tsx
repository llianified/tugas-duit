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
 * Bentuknya satu entri channel Telegram (lihat `.tg-channel` di globals.css): avatar
 * bulat, nama channel, lalu gelembung pesan masuk yang isinya penawarannya sendiri.
 * Alasannya bukan selera: ini satu-satunya kartu di beranda yang bisa HILANG kalau
 * diabaikan, dan sebagai pelat rata ia terbaca sederajat dengan daftar transaksi yang
 * tidak ke mana-mana. Bentuk sebelumnya kupon sobek — logikanya benar (sekali pakai)
 * tapi bendanya salah: yang diminta user bukan menukar kupon, tapi masuk ke channel.
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
    <section aria-label="Bonus join channel" className="tg-channel">
      <div className="tg-channel-body">
        {/* Kepala: pengirimnya. Nama channel jadi baris utama dan syarat "sekali
            seumur akun" pindah ke sini sebagai keterangan pengirim — tempat yang
            benar untuk sebuah syarat, karena ia bukan bagian dari penawarannya. */}
        <div className="flex items-center gap-2.5">
          <span className="tg-channel-avatar">
            {/* `GlyphSvg` sudah menyetel `aria-hidden` sendiri, jadi tidak diulang. */}
            <GlyphTelegram className="size-[1.125rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold tracking-tight text-foreground">
              Channel Tugas Duit
            </p>
            <p className="truncate text-[11px] leading-snug text-muted-foreground">
              Sekali seumur akun
            </p>
          </div>
        </div>

        {/* Gelembung pesan: nominalnya dikirim oleh channel, bukan dilabeli oleh
            kartu. Nilai rupiah tetap di baris kedua sebagai turunan angka di
            atasnya, jadi tidak ada satu nilai yang dibaca dua kali. */}
        <div className="label-gap-t tg-channel-bubble">
          <div className="flex items-baseline gap-1.5">
            <p className="num-display text-[1.75rem] text-primary">
              +{formatCredits(bonus.credits)}
            </p>
            <p className="home-tag pb-0.5">credit</p>
          </div>
          <p className="text-xs leading-snug text-muted-foreground">
            Cair {formatRupiah(creditsToRupiah(bonus.credits))} ke saldo begitu kamu join.
          </p>
        </div>

        {/* Dua tombol berbagi satu baris, dan keduanya memakai `--btn-label` seperti
            "Mulai" di karcis. Yang membedakan derajatnya bidangnya — tenang vs aksen —
            bukan ukuran hurufnya. */}
        <div className="label-gap-t flex gap-2">
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
