'use client'

import { EnergyPips } from '@/features/home/energy-pips'
import { IslandDivider, IslandPill } from '@/features/home/island-pill'
import { StreakGauge } from '@/features/home/streak-gauge'
import { TierGlyph } from '@/features/home/tier-glyph'
import type { Progression } from '@/features/home/progression'
import { ProgressBar } from '@/shared/components/progress-bar'
import { formatCredits, formatUnitCountdown } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export function RankIsland({
  progression,
  energy,
  energyMax,
  energySecondsToNext,
  rewardPoolCredits,
  rewardPoolMax,
  rewardPoolRegenCredits,
  rewardPoolSecondsToNext,
  isOpen,
  slideOutTo,
  onToggle,
  onClose,
}: {
  progression: Progression
  energy: number
  energyMax: number
  energySecondsToNext: number | null
  rewardPoolCredits: number | null
  rewardPoolMax: number | null
  rewardPoolRegenCredits: number | null
  rewardPoolSecondsToNext: number | null
  isOpen: boolean
  slideOutTo?: 'left' | 'right'
  onToggle: () => void
  onClose: () => void
}) {
  const { rank, nextRank, tasksToNextRank, streak, streakSecured } = progression

  const isMaxRank = nextRank === null
  const rankHint = isMaxRank
    ? `Rank tertinggi: ${rank.name}`
    : `${formatCredits(tasksToNextRank)} task menuju rank ${nextRank.name}`

  const poolKnown =
    rewardPoolCredits !== null && rewardPoolMax !== null && rewardPoolRegenCredits !== null

  return (
    <IslandPill
      panelId="tier-progress-island"
      pillLabel={<RankPillLabel rank={rank} />}
      pillTitle={rankHint}
      openLabel={`Buka progres rank ${rank.name}`}
      closeLabel={`Tutup progres rank ${rank.name}`}
      srSummary={
        <>
          , {rankHint}, energi {energy} dari {energyMax}
        </>
      }
      isOpen={isOpen}
      slideOutTo={slideOutTo}
      onToggle={onToggle}
      onClose={onClose}
    >
      <RankProgressRegion progression={progression} isOpen={isOpen} />
      <IslandDivider />
      <StreakRegion streak={streak} streakSecured={streakSecured} isOpen={isOpen} />
      <IslandDivider />
      {poolKnown ? (
        <>
          <RewardPoolRegion
            rewardPoolCredits={rewardPoolCredits}
            rewardPoolMax={rewardPoolMax}
            rewardPoolRegenCredits={rewardPoolRegenCredits}
            rewardPoolSecondsToNext={rewardPoolSecondsToNext}
            isOpen={isOpen}
          />
          <IslandDivider />
        </>
      ) : null}
      <EnergyRegion
        energy={energy}
        energyMax={energyMax}
        energySecondsToNext={energySecondsToNext}
        isOpen={isOpen}
      />
    </IslandPill>
  )
}

function RankPillLabel({ rank }: { rank: Progression['rank'] }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-primary">
      <TierGlyph tier={rank.tier} className="size-3.5 shrink-0" />
      <span className="truncate">
        <span className="sr-only">Rank </span>
        {rank.name}
      </span>
    </span>
  )
}

function RankProgressRegion({
  progression,
  isOpen,
}: {
  progression: Progression
  isOpen: boolean
}) {
  const { rank, nextRank, tasksToNextRank, rankProgress, rankSpan } = progression
  const isMaxRank = nextRank === null
  const progressValue = isMaxRank ? 1 : rankProgress
  const progressMax = isMaxRank ? 1 : rankSpan
  const progressText = isMaxRank
    ? `Rank ${rank.name}, puncak jenjang`
    : `${formatCredits(rankProgress)} dari ${formatCredits(rankSpan)} task menuju rank ${nextRank.name}`

  return (
    <div className="island-region">
      <div className="island-row flex items-center justify-between gap-3">
        <span className="shrink-0 text-[11px] leading-none text-muted-foreground tabular-nums">
          {isMaxRank
            ? `Bonus plafon +${formatCredits((rank.tier - 1) * 3)}`
            : `${formatCredits(tasksToNextRank)} lagi`}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-none text-primary">
          <TierGlyph tier={nextRank?.tier ?? rank.tier} className="size-3.5 shrink-0" />
          <span className="truncate">
            <span className="sr-only">{isMaxRank ? 'Rank ' : 'rank tujuan '}</span>
            {isMaxRank ? rank.name : nextRank.name}
          </span>
        </span>
      </div>
      <ProgressBar
        className="island-row"
        value={isOpen ? progressValue : 0}
        max={progressMax}
        valueText={progressText}
        tone={isMaxRank ? 'success' : 'primary'}
      />
    </div>
  )
}

function StreakRegion({
  streak,
  streakSecured,
  isOpen,
}: {
  streak: number
  streakSecured: boolean
  isOpen: boolean
}) {
  const streakStatus = streakSecured ? 'Aman' : 'Selesaikan 1 task'

  return (
    <div className="island-region">
      <div className="island-row flex items-center justify-between gap-3">
        <span className="shrink-0 text-[11px] leading-none text-muted-foreground tabular-nums">
          {Math.floor(streak / 7) > 0 ? (
            <>
              Streak {formatCredits(streak)} · bonus +
              {formatCredits(Math.min(4, Math.floor(streak / 7)))}
            </>
          ) : (
            <>Streak {formatCredits(streak)} · bonus hari ke-7</>
          )}
        </span>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 text-xs font-semibold leading-none',
            streakSecured ? 'text-success' : 'text-muted-foreground',
          )}
        >
          {streakStatus}
        </span>
      </div>
      <StreakGauge
        className="island-row"
        streak={streak}
        atRisk={!streakSecured}
        active={isOpen}
      />
    </div>
  )
}

function RewardPoolRegion({
  rewardPoolCredits,
  rewardPoolMax,
  rewardPoolRegenCredits,
  rewardPoolSecondsToNext,
  isOpen,
}: {
  rewardPoolCredits: number
  rewardPoolMax: number
  rewardPoolRegenCredits: number
  rewardPoolSecondsToNext: number | null
  isOpen: boolean
}) {
  const poolLeft = Math.max(0, Math.min(rewardPoolMax, rewardPoolCredits))
  const poolFull = rewardPoolSecondsToNext === null
  const poolStatus = poolFull
    ? 'Kolam penuh'
    : `+${formatCredits(rewardPoolRegenCredits)} · ${formatUnitCountdown(rewardPoolSecondsToNext)}`

  return (
    <div className="island-region">
      <div className="island-row flex items-center justify-between gap-3">
        <span className="shrink-0 text-[11px] leading-none text-muted-foreground tabular-nums">
          Kolam {formatCredits(poolLeft)}/{formatCredits(rewardPoolMax)}
        </span>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 text-xs font-semibold leading-none',
            poolFull ? 'text-success' : 'text-primary',
          )}
        >
          <span className="sr-only">Kolam reward </span>
          <span className="tabular-nums">{poolStatus}</span>
        </span>
      </div>
      <ProgressBar
        className="island-row"
        value={isOpen ? poolLeft : 0}
        max={rewardPoolMax}
        valueText={`${formatCredits(poolLeft)} dari ${formatCredits(rewardPoolMax)} credit kolam reward tersisa`}
      />
    </div>
  )
}

function EnergyRegion({
  energy,
  energyMax,
  energySecondsToNext,
  isOpen,
}: {
  energy: number
  energyMax: number
  energySecondsToNext: number | null
  isOpen: boolean
}) {
  const energyFull = energySecondsToNext === null
  const energyStatus = energyFull
    ? 'Energi penuh'
    : `+1 · ${formatUnitCountdown(energySecondsToNext)}`

  return (
    <div className="island-region">
      <div className="island-row flex items-center justify-between gap-3">
        <span className="shrink-0 text-[11px] leading-none text-muted-foreground tabular-nums">
          Energi {formatCredits(energy)}/{formatCredits(energyMax)}
        </span>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 text-xs font-semibold leading-none',
            energyFull ? 'text-success' : 'text-primary',
          )}
        >
          <span className="tabular-nums">{energyStatus}</span>
        </span>
      </div>
      <EnergyPips className="island-row" energy={energy} max={energyMax} active={isOpen} />
    </div>
  )
}
