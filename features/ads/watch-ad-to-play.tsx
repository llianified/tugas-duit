'use client'

import { adsMaxViewsPerDay } from '@/domain/ads/ads'
import { GlyphPlay, GlyphSpinner } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { TapAction, TapActionWaiting } from '@/shared/components/tap-action'
import { hapticTap } from '@/shared/lib/haptic'
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
        tone="neutral"
        icon={<GlyphSpinner className="size-4 animate-spin text-muted-foreground" />}
        label="Memuat"
      />
    )

  if (passReady)
    return (
      <TapAction
        compact
        tone="neutral"
        icon={<GlyphPlay className="size-4 text-muted-foreground" />}
        label="Pakai tiket"
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
        tone="neutral"
        icon={<GlyphPlay className="size-4 text-muted-foreground" />}
        label="Jatah habis"
      />
    )

  if (cooldownSecondsLeft > 0)
    return (
      <TapActionWaiting
        compact
        tone="neutral"
        icon={<GlyphPlay className="size-4 text-muted-foreground" />}
        label="Iklan belum siap"
        meta={formatCountdown(cooldownSecondsLeft)}
      />
    )

  return (
    <TapAction
      compact
      tone="neutral"
      label="Tonton iklan"
      meta={
        <MetaBadge className="gap-1">
          <GlyphPlay className="size-3 shrink-0" aria-hidden="true" />
          {formatCredits(viewsLeft)}/{formatCredits(adsMaxViewsPerDay())}
        </MetaBadge>
      }
      aria-label={`Tonton iklan untuk memulai task tanpa energi, sisa ${formatCredits(viewsLeft)} dari ${formatCredits(adsMaxViewsPerDay())} kali hari ini`}
      onClick={() => {
        hapticTap()
        onWatch()
      }}
    />
  )
}
