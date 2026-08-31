'use client'

import { EnergyPips } from '@/features/home/energy-pips'
import { IslandDivider, IslandPill, IslandStat } from '@/features/home/island-pill'
import { StreakGauge } from '@/features/home/streak-gauge'
import { TierGlyph } from '@/features/home/tier-glyph'
import type { Progression } from '@/features/home/progression'
import type { EnergyFill } from '@/domain/energy'
import { ProgressBar } from '@/shared/components/progress-bar'
import { formatCredits, formatLongCountdown, formatUnitCountdown } from '@/shared/lib/format'

export function RankIsland({
  progression,
  energy,
  energyMax,
  energyFill,
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
  energyFill: EnergyFill
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
      <EnergyRegion energy={energy} energyMax={energyMax} fill={energyFill} isOpen={isOpen} />
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
    <IslandStat
      label={
        isMaxRank
          ? `Bonus plafon +${formatCredits((rank.tier - 1) * 3)}`
          : `${formatCredits(tasksToNextRank)} task lagi`
      }
      tone="primary"
      value={
        <span className="flex min-w-0 items-center gap-1.5">
          <TierGlyph tier={nextRank?.tier ?? rank.tier} className="size-3.5 shrink-0" />
          <span className="truncate">
            <span className="sr-only">{isMaxRank ? 'Rank ' : 'rank tujuan '}</span>
            {isMaxRank ? rank.name : nextRank.name}
          </span>
        </span>
      }
      meter={
        <ProgressBar
          value={isOpen ? progressValue : 0}
          max={progressMax}
          valueText={progressText}
          tone={isMaxRank ? 'success' : 'primary'}
        />
      }
    />
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
  const bonusWeeks = Math.floor(streak / 7)

  return (
    <IslandStat
      label={
        bonusWeeks > 0 ? (
          <>
            Streak {formatCredits(streak)} · bonus +{formatCredits(Math.min(4, bonusWeeks))}
          </>
        ) : (
          <>Streak {formatCredits(streak)} · bonus hari ke-7</>
        )
      }
      tone={streakSecured ? 'success' : 'muted'}
      value={streakSecured ? 'Aman' : 'Selesaikan 1 task'}
      meter={<StreakGauge streak={streak} atRisk={!streakSecured} active={isOpen} />}
    />
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

  return (
    <IslandStat
      label="Stok reward"
      tone={poolFull ? 'success' : 'primary'}
      value={
        poolFull
          ? 'Penuh'
          : `+${formatCredits(rewardPoolRegenCredits)} · ${formatUnitCountdown(rewardPoolSecondsToNext)}`
      }
      meter={
        <ProgressBar
          value={isOpen ? poolLeft : 0}
          max={rewardPoolMax}
          valueText={`${formatCredits(poolLeft)} dari ${formatCredits(rewardPoolMax)} credit stok reward tersisa`}
        />
      }
    />
  )
}

/**
 * Energi dilaporkan sebagai "penuh dalam sekian", bukan "+1 sekian".
 *
 * Hitungan per butir memberi user angka terburuk yang bisa dia lihat setiap
 * kali membuka panel, padahal yang dia rencanakan adalah kapan bisa main
 * banyak lagi — dan itu waktu menuju penuh.
 */
function EnergyRegion({
  energy,
  energyMax,
  fill,
  isOpen,
}: {
  energy: number
  energyMax: number
  fill: EnergyFill
  isOpen: boolean
}) {
  const secondsToFull = fill.secondsToFull

  return (
    <IslandStat
      label={`Energi ${formatCredits(energy)}/${formatCredits(energyMax)}`}
      tone={secondsToFull === null ? 'success' : 'primary'}
      value={secondsToFull === null ? 'Penuh' : `Penuh dalam ${formatLongCountdown(secondsToFull)}`}
      meter={
        <EnergyPips energy={energy} max={energyMax} fraction={fill.fraction} active={isOpen} />
      }
    />
  )
}
