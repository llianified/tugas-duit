'use client'

import type { CSSProperties } from 'react'
import { creditsToRupiah } from '@/domain/economy/economy'
import { CHANNEL_STAMP_MS, useChannelBonus } from '@/features/channel/use-channel-bonus'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphCheck, GlyphTelegram } from '@/shared/components/glyph'
import type { ChannelBonusState } from '@/shell/session-api'
import { formatCredits, formatRupiah } from '@/shared/lib/format'

/** Kartu ini tidak menjaga dirinya sendiri: syarat "bonusnya masih ada" hidup di `channelBonusReachable`, dipanggil oleh `HomeView` yang juga memakai jawabannya untuk menyusun daftar kartu carousel. Kartu yang mengembalikan `null` sendiri berarti aturan yang sama tertulis di dua lapisan.

Bentuknya perangko — kertas, gigi, bingkai cetak, dan tata letak yang SAMA dengan kartu premium (lihat `.stamp` di globals.css), dibedakan hanya oleh `--stamp-accent` lewat `.stamp-channel`: tintanya biru, bukan emas. Sebelumnya kartu ini kupon yang disobek. Yang mengubahnya bukan selera: keduanya kertas berukuran penuh yang menuntut aksi dan sekarang bergantian di SATU tempat, jadi dua bahasa bentuk yang berbeda di posisi yang sama membuat perpindahannya terbaca sebagai halaman yang berganti isi — bukan sebagai satu tempat yang menyimpan dua kartu.

Arah "sekali pakai" yang dulu dibawa sobekan tidak hilang, ia pindah ke CAP: perangko bercap tidak bisa dipakai dua kali, dan capnya sudah jadi bahasa halaman ini lewat premium yang aktif. Capnya dipasang HANYA di klaim, bukan di "Join" — membuka channel di tab lain tidak menghabiskan apa pun. */
export function ChannelBonusCard({
  bonus,
  onClaimed,
}: {
  bonus: ChannelBonusState
  onClaimed: () => Promise<unknown>
}) {
  const { claiming, stamped, claim } = useChannelBonus({ onClaimed })

  return (
    <section
      aria-label="Bonus join channel"
      className="stamp stamp-channel"
      data-stamping={stamped ? 'true' : undefined}
      style={{ '--stamp-ms': `${CHANNEL_STAMP_MS}ms` } as CSSProperties}
    >
      {/* Nominal perangko, di tempat dan ukuran yang sama dengan harga di kartu
          premium: dua kertas dari mesin yang sama, satu tinggi angka. */}
      <div className="flex items-start justify-between gap-3">
        <p className="home-tag stamp-tag pt-1">Bonus</p>
        <p className="flex flex-col items-end gap-1">
          <span className="num-display stamp-ink-fg text-[1.375rem]">
            +{formatCredits(bonus.credits)}
          </span>
          <span className="home-tag">credit</span>
        </p>
      </div>

      {/* Posisi potret: pesawat kertas, benda yang sama dengan yang ada di tombol
          "Join" di bawahnya. `GlyphSvg` sudah menyetel `aria-hidden` sendiri. */}
      <div className="stack-gap-t flex items-start gap-2">
        <span className="stamp-portrait">
          <GlyphTelegram className="stamp-ink-fg size-4" />
        </span>
        <span className="text-sm font-semibold leading-snug text-foreground">
          Join channel, dapat {formatRupiah(creditsToRupiah(bonus.credits))} ke saldo.
        </span>
      </div>

      <p className="stack-gap-t text-xs leading-snug text-muted-foreground">
        Sekali per akun. Setelah diklaim, bonus ini tidak muncul lagi.
      </p>

      {/* Dua tombol berbagi satu baris, dan keduanya memakai `--btn-label` seperti
          "Mulai" di karcis. Yang membedakan derajatnya bidangnya — tenang vs aksen —
          bukan ukuran hurufnya. `.stamp-foot` yang menahannya di garis bawah kertas,
          supaya barisnya berhenti setinggi baris aksi kartu premium di slide lain. */}
      <div className="stamp-foot flex gap-2">
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
        <ActionButton size="sm" className="flex-[1.6]" onClick={claim} disabled={claiming}>
          {claiming ? 'Mengecek…' : 'Klaim bonus'}
        </ActionButton>
      </div>

      {/* Capnya hanya ada setelah klaim berhasil. Digambar paling akhir supaya ia
          berdiri di atas seluruh isi kertas, dan `aria-hidden` karena yang perlu
          didengar bukan gambarnya melainkan hasilnya — itu tugas `role="status"`
          di bawahnya, yang berbunyi sebelum kartunya dilepas dari beranda. */}
      {stamped ? (
        <>
          <span className="stamp-strike" aria-hidden="true">
            <span className="stamp-postmark stamp-tag">
              <GlyphCheck className="size-5" />
              <span className="home-tag mt-0.5">Cair</span>
            </span>
          </span>
          <p role="status" className="sr-only">
            Bonus cair {formatRupiah(creditsToRupiah(bonus.credits))} ke saldo.
          </p>
        </>
      ) : null}
    </section>
  )
}
