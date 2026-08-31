'use client'

import { useCallback, useState } from 'react'
import { creditsToRupiah } from '@/domain/economy'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphTelegram } from '@/shared/components/glyph'
import { userFacingMessage } from '@/shell/api-client'
import { claimChannelBonus, type ChannelBonusState } from '@/shell/session-api'
import { formatCredits, formatRupiah } from '@/shared/lib/format'

export function ChannelBonusCard({
  bonus,
  onClaimed,
}: {
  bonus: ChannelBonusState
  onClaimed: () => Promise<unknown>
}) {
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const claim = useCallback(async () => {
    setError(null)
    setClaiming(true)
    try {
      await claimChannelBonus()
      await onClaimed()
    } catch (cause) {
      setError(userFacingMessage(cause))
    } finally {
      setClaiming(false)
    }
  }, [onClaimed])

  if (!bonus.enabled || bonus.claimed) return null

  return (
    <section
      aria-label="Bonus join channel"
      className="rounded-lg bg-muted/60 p-[var(--surface-p)] ring-border"
    >
      <div className="flex items-start gap-2">
        <GlyphTelegram className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            Join channel, dapat {formatCredits(bonus.credits)} credit
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Sekali seumur akun, langsung masuk saldo (
            {formatRupiah(creditsToRupiah(bonus.credits))}). Kami cek keanggotaan kamu ke Telegram,
            jadi join dulu ya sebelum klaim.
          </p>
        </div>
      </div>

      {error ? <p className="stack-gap-t text-xs text-destructive">{error}</p> : null}

      <div className="stack-gap-t flex gap-2">
        <a
          href={bonus.url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring transition-ui press-scale-soft control-h flex flex-1 items-center justify-center rounded-cta bg-transparent text-[15px] font-bold tracking-tight text-foreground ring-border"
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
