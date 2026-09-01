'use client'

import { useCallback, useState } from 'react'
import { creditsToRupiah } from '@/domain/economy'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphTelegram } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { userFacingMessage } from '@/shell/api-client'
import { claimChannelBonus, type ChannelBonusState } from '@/shell/session-api'
import { useToast } from '@/shell/toast'
import { formatCredits, formatRupiah } from '@/shared/lib/format'

export function ChannelBonusCard({
  bonus,
  onClaimed,
}: {
  bonus: ChannelBonusState
  onClaimed: () => Promise<unknown>
}) {
  const [claiming, setClaiming] = useState(false)
  const showError = useToast()

  const claim = useCallback(async () => {
    setClaiming(true)
    try {
      await claimChannelBonus()
      await onClaimed()
    } catch (cause) {
      showError(userFacingMessage(cause))
    } finally {
      setClaiming(false)
    }
  }, [onClaimed, showError])

  if (!bonus.enabled || bonus.claimed) return null

  return (
    <section
      aria-label="Bonus join channel"
      className="rounded-lg bg-muted/60 p-[var(--surface-p)] ring-border"
    >
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
        <a
          href={bonus.url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring transition-ui press-scale-soft control-h flex flex-1 items-center justify-center rounded-cta btn-soft text-[15px] font-bold tracking-tight text-foreground"
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
