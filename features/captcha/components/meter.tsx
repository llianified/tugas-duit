'use client'

import { useEffect } from 'react'
import { StarRating } from '@/shared/components/star-rating'
import type { Difficulty } from '@/domain/task/challenge'
import { formatCredits } from '@/shared/lib/format'
import { useCssVars } from '@/shared/lib/use-css-vars'
import { getLiveStarState } from '@/domain/progression/stars'

export function CaptchaMeter({
  difficulty,
  parScale = 1,
  elapsedMs,
  rewardPoolCredits,
  onRewardChange,
}: {
  difficulty: Difficulty
  /** Pengali par time varian soal ini; meter harus memakai jendela yang sama dengan yang dipakai server menilai. */
  parScale?: number
  elapsedMs: number
  rewardPoolCredits: number | null
  onRewardChange: (reward: number) => void
}) {
  const { stars, reward, remainingRatio } = getLiveStarState(elapsedMs, difficulty, parScale)
  const payable =
    rewardPoolCredits === null ? reward : Math.max(0, Math.min(reward, rewardPoolCredits))
  const capped = payable < reward

  useEffect(() => {
    onRewardChange(payable)
  }, [onRewardChange, payable])

  const barRef = useCssVars<HTMLDivElement>({
    '--meter-remaining': `${Math.round(remainingRatio * 100)}%`,
  })

  return (
    <div
      role="timer"
      aria-label={
        capped
          ? `${stars} bintang, reward sekarang ${payable} TD karena sisa stok reward segitu, sisa waktu ${Math.round(remainingRatio * 100)} persen`
          : `${stars} bintang, reward sekarang ${payable} TD, sisa waktu ${Math.round(remainingRatio * 100)} persen`
      }
    >
      <div aria-hidden className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Sisa waktu</span>
          <StarRating stars={stars} size="sm" />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            ref={barRef}
            className="meter-fill h-full w-[var(--meter-remaining,100%)] rounded-full transition-[width] duration-100 ease-linear"
          />
        </div>
      </div>

      {capped ? (
        <p className="label-gap-t text-[11px] leading-tight text-muted-foreground">
          Stok reward kamu tinggal {formatCredits(payable)} TD, jadi segitu yang dibayar buat
          soal ini. Stoknya keisi lagi pelan-pelan.
        </p>
      ) : null}
    </div>
  )
}
