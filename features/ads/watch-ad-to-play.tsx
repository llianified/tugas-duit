'use client'

import { useState } from 'react'
import { adsMaxViewsPerDay } from '@/domain/ads'
import { AdConfirmDialog } from '@/features/ads/ad-confirm-dialog'
import { GlyphPlay, GlyphSpinner } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
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
  const [confirmOpen, setConfirmOpen] = useState(false)

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
    <>
      <TapAction
        compact
        tone="neutral"
        label="Iklan"
        meta={
          <MetaBadge className="gap-1">
            <GlyphPlay className="size-3 shrink-0" aria-hidden="true" />
            sisa {formatCredits(viewsLeft)}
          </MetaBadge>
        }
        aria-label={`Nonton iklan untuk memulai task tanpa energi, sisa ${formatCredits(viewsLeft)} dari ${formatCredits(adsMaxViewsPerDay())} kali hari ini`}
        onClick={() => {
          hapticTap()
          setConfirmOpen(true)
        }}
      />

      <AdConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        viewsLeft={viewsLeft}
        onConfirm={onWatch}
      />
    </>
  )
}
