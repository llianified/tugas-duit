'use client'

import { GlyphPlay, GlyphSpinner } from '@/shared/components/glyph'
import { TapAction, TapActionWaiting } from '@/shared/components/tap-action'
import { hapticTap } from '@/shared/lib/haptic'
import { formatCountdown, formatCredits } from '@/shared/lib/format'

/** Urutan cabang di bawah sengaja sama persis dengan `adOpenRefusal` di `domain/ads/ads.ts`: pass dulu, lalu entry yang masih terbuka, baru jatah, baru cooldown. Kalau urutannya berbeda, tombolnya akan menawarkan sesuatu yang server tolak dengan alasan lain — dan user yang membaca dua penjelasan berbeda untuk satu ketukan akan berhenti mempercayai keduanya. */
export function WatchAdToPlay({
  enabled,
  viewsLeft,
  maxViews,
  cooldownSecondsLeft,
  passReady,
  passSecondsLeft,
  entryOpen,
  watching,
  poolEmpty,
  urgent = false,
  onWatch,
}: {
  enabled: boolean
  viewsLeft: number
  maxViews: number
  cooldownSecondsLeft: number
  passReady: boolean
  /** Sisa umur tiket, diproyeksikan klien dari `pass.expiresAt`. */
  passSecondsLeft: number | null
  /** Ada task atau ronde Arena berbayar tiket yang belum ditutup; server pasti menolak tiket baru. */
  entryOpen: boolean
  watching: boolean
  poolEmpty: boolean
  /** Energi habis, jadi tiket iklan bukan lagi cara kedua — ia satu-satunya cara main sekarang.
   *
   * Ada karena angkanya jelas: 75% user aktif tidak pernah menonton satu iklan pun, sementara
   * plafon hariannya menganggur hampir utuh. Penyebabnya terbaca di layar — saat energi habis,
   * tombol energi berubah jadi hitung mundur dan tombol ini tetap `neutral`, jadi satu-satunya
   * hal yang menonjol adalah waktu tunggu. User membaca "nanti", lalu menutup app. Yang digeser
   * cuma penonjolannya, bukan aturannya: server tetap menuntut `payWith` yang eksplisit. */
  urgent?: boolean
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
        tone={urgent ? 'primary' : 'neutral'}
        icon={<GlyphPlay className={urgent ? 'size-4' : 'size-4 text-muted-foreground'} />}
        label="Pakai tiket"
        meta={passSecondsLeft === null ? undefined : formatCountdown(passSecondsLeft)}
        aria-label={
          passSecondsLeft === null
            ? 'Mulai soal pakai tiket iklan'
            : `Mulai soal pakai tiket iklan, hangus dalam ${formatCountdown(passSecondsLeft)}`
        }
        onClick={() => {
          hapticTap()
          onWatch()
        }}
      />
    )

  /** Tiket berikutnya baru boleh dibuka setelah ongkos masuk sebelumnya ditutup — task, atau ronde Arena yang juga dibayar pass. Dulu keadaan ini tidak terlihat sama sekali: tombolnya tetap tampak normal dan baru menolak lewat toast setelah diketuk. Untuk task, jalan keluarnya ada tepat di sebelah kiri — tombol "Lanjutkan" pada task yang sama, dan melanjutkannya tidak menagih ongkos apa pun lagi. */
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
      tone={urgent ? 'primary' : 'neutral'}
      label="Tonton iklan"
      /** Sisa jatah adalah angka yang berarti selama masih ada cara lain untuk main. Begitu energi
       * habis ia berhenti menjawab pertanyaan yang sedang dipikirkan user — bukan "berapa jatahku"
       * melainkan "kalau kutonton, aku dapat apa". Pecahannya kembali saat energinya ada. */
      meta={urgent ? '1 soal' : `${formatCredits(viewsLeft)}/${formatCredits(maxViews)}`}
      aria-label={`Tonton iklan buat mulai soal tanpa energi, sisa ${formatCredits(viewsLeft)} kali hari ini`}
      onClick={() => {
        hapticTap()
        onWatch()
      }}
    />
  )
}
