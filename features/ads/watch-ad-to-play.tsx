'use client'

import { GlyphPlay, GlyphSpinner } from '@/shared/components/glyph'
import { TapAction, TapActionWaiting } from '@/shared/components/tap-action'
import { hapticTap } from '@/shell/haptic'
import { formatCountdown, formatCredits } from '@/shared/lib/format'

export function WatchAdToPlay({
  enabled,
  viewsLeft,
  cooldownSecondsLeft,
  passReady,
  watching,
  poolEmpty,
  onWatch,
}: {
  enabled: boolean
  viewsLeft: number
  cooldownSecondsLeft: number
  passReady: boolean
  watching: boolean
  poolEmpty: boolean
  onWatch: () => void
}) {
  if (!enabled || poolEmpty) return null

  if (watching)
    return (
      <TapActionWaiting
        compact
        icon={<GlyphSpinner className="size-4 animate-spin text-muted-foreground" />}
        label="Iklannya lagi diputar"
      />
    )

  if (passReady)
    return (
      <TapAction
        tone="neutral"
        icon={<GlyphPlay className="size-4" />}
        label="Mulai pakai tiket iklan"
        aria-label="Mulai task memakai tiket iklan"
        onClick={() => {
          hapticTap()
          onWatch()
        }}
      />
    )

  if (viewsLeft <= 0)
    return (
      <TapActionWaiting
        compact
        icon={<GlyphPlay className="size-4" />}
        label="Jatah iklan hari ini habis"
      />
    )

  if (cooldownSecondsLeft > 0)
    return (
      <TapActionWaiting
        compact
        icon={<GlyphPlay className="size-4" />}
        label="Iklan berikutnya belum siap"
        meta={formatCountdown(cooldownSecondsLeft)}
      />
    )

  return (
    <TapAction
      tone="neutral"
      icon={<GlyphPlay className="size-4" />}
      label="Bayar pakai iklan"
      meta={`sisa ${formatCredits(viewsLeft)}`}
      aria-label="Nonton iklan untuk memulai task tanpa energi"
      onClick={() => {
        hapticTap()
        onWatch()
      }}
    />
  )
}
