'use client'

import { DifficultyMeter } from '@/features/captcha/components/difficulty-badge'
import { DIFFICULTY_LABEL, type Difficulty } from '@/domain/task/challenge'
import { IslandDivider, IslandPill } from '@/features/home/island-pill'
import { getStarCutoffs, getStarReward, type StarCount } from '@/domain/progression/stars'
import { StarRating } from '@/shared/components/star-rating'
import { formatCredits, formatDuration } from '@/shared/lib/format'

export function DifficultyIsland({
  difficulty,
  reward,
  isOpen,
  slideOutTo,
  onToggle,
  onClose,
}: {
  difficulty: Difficulty
  reward: number
  isOpen: boolean
  slideOutTo?: 'left' | 'right'
  onToggle: () => void
  onClose: () => void
}) {
  const label = DIFFICULTY_LABEL[difficulty]
  const maxReward = getStarReward(difficulty, 3)

  return (
    <IslandPill
      panelId="task-difficulty-island"
      pillLabel={
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground">
          <DifficultyMeter difficulty={difficulty} />
          <span className="sr-only">Kesulitan </span>
          <span>{label}</span>
          <span className="font-semibold tabular-nums text-primary">+{formatCredits(reward)}</span>
        </span>
      }
      pillTitle={`Kesulitan ${label}, reward sekarang ${formatCredits(reward)} TD`}
      openLabel={`Buka rincian kesulitan ${label}`}
      closeLabel={`Tutup rincian kesulitan ${label}`}
      srSummary={`, reward sekarang ${formatCredits(reward)} TD`}
      isOpen={isOpen}
      slideOutTo={slideOutTo}
      onToggle={onToggle}
      onClose={onClose}
      className="pl-1.5"
    >
      <DifficultySummaryRegion maxReward={maxReward} />
      <IslandDivider />
      <StarTierRegion difficulty={difficulty} />
    </IslandPill>
  )
}

function DifficultySummaryRegion({ maxReward }: { maxReward: number }) {
  return (
    <div className="island-region">
      <div className="island-row flex items-center justify-between gap-3">
        <span className="shrink-0 text-[11px] leading-none text-muted-foreground">
          Reward ditentukan kecepatan
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold leading-none text-primary tabular-nums">
          Maksimum {formatCredits(maxReward)} TD
        </span>
      </div>
    </div>
  )
}

function StarTierRegion({ difficulty }: { difficulty: Difficulty }) {
  const cutoffs = getStarCutoffs(difficulty)
  const tiers: { stars: StarCount; window: string; reward: number }[] = [
    { stars: 3, window: `Sampai ${formatDuration(cutoffs[3])}`, reward: getStarReward(difficulty, 3) },
    { stars: 2, window: `Sampai ${formatDuration(cutoffs[2])}`, reward: getStarReward(difficulty, 2) },
    { stars: 1, window: `Di atas ${formatDuration(cutoffs[2])}`, reward: getStarReward(difficulty, 1) },
  ]

  return (
    <div className="island-region">
      {tiers.map((tier) => (
        <div key={tier.stars} className="island-row flex items-center justify-between gap-3">
          <StarRating stars={tier.stars} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[11px] leading-none text-muted-foreground tabular-nums">
            {tier.window}
          </span>
          <span className="shrink-0 text-xs font-semibold leading-none text-foreground tabular-nums">
            {formatCredits(tier.reward)} TD
          </span>
        </div>
      ))}
    </div>
  )
}
