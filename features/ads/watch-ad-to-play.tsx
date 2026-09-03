'use client'

import { GlyphPlay, GlyphSpinner } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { TapAction, TapActionWaiting } from '@/shared/components/tap-action'
import { hapticTap } from '@/shared/lib/haptic'
import { formatCountdown, formatCredits } from '@/shared/lib/format'

/** Urutan cabang di bawah sengaja sama persis dengan `adOpenRefusal` di `domain/ads/ads.ts`: pass dulu, lalu entry yang masih terbuka, baru jatah, baru cooldown. Kalau urutannya berbeda, tombolnya akan menawarkan sesuatu yang server tolak dengan alasan lain — dan user yang membaca dua penjelasan berbeda untuk satu ketukan akan berhenti mempercayai keduanya. */
export function WatchAdToPlay({
  enabled,
  viewsLeft,
  cooldownSecondsLeft,
  passReady,
  passSecondsLeft,
  entryOpen,
  watching,
  poolEmpty,
  onWatch,
}: {
  enabled: boolean
  viewsLeft: number
  cooldownSecondsLeft: number
  passReady: boolean
  /** Sisa umur tiket, diproyeksikan klien dari `pass.expiresAt`. */
  passSecondsLeft: number | null
  /** Ada task berbayar tiket yang belum ditutup; server pasti menolak tiket baru. */
  entryOpen: boolean
  watching: boolean
  poolEmpty: boolean
  onWatch: () => void
}) {
  if (!enabled || poolEmpty) return null

  if (watching)
    return (
      <TapActionWaiting
        compact
        tone="neutral"
        icon={<GlyphSpinner className="size-4 animate-spin text-muted-foreground" />}
        label="Memuat"
      />
    )

  /** Hitung mundurnya ikut dicetak, bukan disimpan sendiri. Tiket punya umur (`adsPassTtlMinutes`) dan hangusnya memotong jatah harian — user yang tidak diberi tahu sisa waktunya hanya bisa menyimpulkan tontonannya sia-sia. */
  if (passReady)
    return (
      <TapAction
        compact
        tone="neutral"
        icon={<GlyphPlay className="size-4 text-muted-foreground" />}
        label="Pakai tiket"
        meta={passSecondsLeft === null ? undefined : formatCountdown(passSecondsLeft)}
        aria-label={
          passSecondsLeft === null
            ? 'Mulai task memakai tiket iklan'
            : `Mulai task memakai tiket iklan, hangus dalam ${formatCountdown(passSecondsLeft)}`
        }
        onClick={() => {
          hapticTap()
          onWatch()
        }}
      />
    )

  /** Tiket berikutnya baru boleh dibuka setelah task yang dibayar tiket sebelumnya ditutup. Dulu keadaan ini tidak terlihat sama sekali: tombolnya tetap tampak normal dan baru menolak lewat toast setelah diketuk. Jalan keluarnya ada tepat di sebelah kiri — tombol "Lanjutkan" pada task yang sama, dan melanjutkannya tidak menagih ongkos apa pun lagi. */
  if (entryOpen)
    return (
      <TapActionWaiting
        compact
        tone="neutral"
        icon={<GlyphPlay className="size-4 text-muted-foreground" />}
        label="Selesaikan dulu"
      />
    )

  if (viewsLeft <= 0)
    return (
      <TapActionWaiting
        compact
        tone="neutral"
        icon={<GlyphPlay className="size-4 text-muted-foreground" />}
        label="Jatah habis"
        meta="besok"
      />
    )

  /** "Iklan belum siap" dulu menyalahkan jaringan iklan untuk jeda yang justru dipasang aplikasi ini sendiri (`adsCooldownSeconds`). Bedanya penting: stok yang habis tidak bisa diapa-apakan user, sedangkan jeda pasti lewat — dan angkanya ada di sebelahnya. */
  if (cooldownSecondsLeft > 0)
    return (
      <TapActionWaiting
        compact
        tone="neutral"
        icon={<GlyphPlay className="size-4 text-muted-foreground" />}
        label="Jeda iklan"
        meta={formatCountdown(cooldownSecondsLeft)}
      />
    )

  return (
    <TapAction
      compact
      tone="neutral"
      label="Tonton iklan"
      /** "9/10" terbaca seperti kemajuan yang naik, padahal angkanya menghitung turun. Satuannya sekarang disebut supaya tidak ada yang perlu ditebak. */
      meta={<MetaBadge>{formatCredits(viewsLeft)} tersisa</MetaBadge>}
      aria-label={`Tonton iklan untuk memulai task tanpa energi, sisa ${formatCredits(viewsLeft)} kali hari ini`}
      onClick={() => {
        hapticTap()
        onWatch()
      }}
    />
  )
}
