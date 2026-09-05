'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphChevron } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { ResultPanel } from '@/shared/components/result-panel'
import { StarRating } from '@/shared/components/star-rating'
import type { TaskOutcome } from '@/domain/task/challenge'
import { useConfettiBurst } from '@/shared/lib/confetti'
import { creditsToRupiah } from '@/domain/economy/economy'
import {
  formatCredits,
  formatCreditsPrecise,
  formatDuration,
  formatRupiah,
} from '@/shared/lib/format'

const BURST_DELAY_MS = 580

export function CaptchaSuccessPanel({
  outcome,
  balance,
  turboRewardEnabled,
  onNext,
  onExit,
}: {
  outcome: TaskOutcome
  balance: number
  turboRewardEnabled: boolean
  onNext: () => void
  onExit: () => void
}) {
  const badgeRef = useRef<HTMLDivElement>(null)
  const burst = useConfettiBurst()

  useEffect(() => {
    const timer = window.setTimeout(() => burst(badgeRef.current), BURST_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [burst])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="animate-rise-in flex min-h-0 flex-1 flex-col">
        <ResultPanel
          credits={formatCredits(outcome.reward)}
          prefix="+"
          tone="primary"
          amountSize="2xl"
          rupiah={formatRupiah(creditsToRupiah(outcome.reward))}
          className="gap-4"
        >
          <div className="flex flex-col items-center gap-2">
            <div ref={badgeRef}>
              <StarRating stars={outcome.stars} size="lg" animated />
            </div>
            {turboRewardEnabled ? <MetaBadge tone="primary">Turbo Reward</MetaBadge> : null}
          </div>
        </ResultPanel>
      </div>

      <div className="animate-rise-in stagger-1">
        <OutcomeDetails elapsedMs={outcome.elapsedMs} balance={balance} />
      </div>

      <div className="animate-rise-in stagger-2 flex flex-col gap-3">
        <ActionButton onClick={onNext}>
          Lanjut
          <GlyphChevron className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-active:translate-x-1" />
        </ActionButton>
        <ActionButton variant="quiet" onClick={onExit}>
          Beranda
        </ActionButton>
      </div>
    </div>
  )
}

function OutcomeDetails({
  elapsedMs,
  balance,
}: {
  elapsedMs: number
  balance: number
}) {
  return (
    <section aria-label="Rincian hasil" className="panel-t">
      <dl className="flex flex-col gap-2 text-xs">
        <DetailRow label="Durasi pengerjaan">{formatDuration(elapsedMs)}</DetailRow>
        <DetailRow label="Saldo kini">
          {formatCreditsPrecise(balance)}{' '}
          <span className="font-normal text-muted-foreground">TD</span>{' '}
          <span className="font-normal text-muted-foreground">
            · {formatRupiah(creditsToRupiah(balance))}
          </span>
        </DetailRow>
      </dl>
    </section>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{children}</dd>
    </div>
  )
}
