'use client'

import { EnergyPips } from '@/features/home/energy-pips'
import { IslandDivider, IslandPill, IslandStat } from '@/features/home/island-pill'
import { StreakGauge } from '@/features/home/streak-gauge'
import { TierGlyph } from '@/shared/components/tier-glyph'
import type { Progression } from '@/domain/progression/progression'
import type { EnergyFill } from '@/domain/economy/energy'
import { ProgressBar } from '@/shared/components/progress-bar'
import { formatCredits } from '@/shared/lib/format'

export function RankIsland({
  progression,
  energy,
  energyMax,
  energyFill,
  rewardPoolCredits,
  rewardPoolMax,
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

  const poolKnown = rewardPoolCredits !== null && rewardPoolMax !== null

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
      <RankProgressRegion progression={progression} />
      <IslandDivider />
      <StreakRegion streak={streak} streakSecured={streakSecured} />
      <IslandDivider />
      {poolKnown ? (
        <>
          <RewardPoolRegion
            rewardPoolCredits={rewardPoolCredits}
            rewardPoolMax={rewardPoolMax}
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
    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <TierGlyph tier={rank.tier} className="size-3.5 shrink-0" />
      <span className="truncate">
        <span className="sr-only">Rank </span>
        {rank.name}
      </span>
    </span>
  )
}

/** Setiap region hanya menampilkan judul dan meter. Angka mentahnya tetap hidup di `valueText` meter, jadi pembaca layar masih mendapat progres yang persis sama sementara panelnya tampil sebagai bentuk, bukan sebagai papan angka yang menuntut dibaca. */
function RankProgressRegion({ progression }: { progression: Progression }) {
  const { rank, nextRank, rankProgress, rankSpan } = progression
  const isMaxRank = nextRank === null
  const progressValue = isMaxRank ? 1 : rankProgress
  const progressMax = isMaxRank ? 1 : rankSpan
  const progressText = isMaxRank
    ? `Rank ${rank.name}, puncak jenjang`
    : `${formatCredits(rankProgress)} dari ${formatCredits(rankSpan)} task menuju rank ${nextRank.name}`

  return (
    <IslandStat
      label="Rank"
      meter={
        <ProgressBar
          value={progressValue}
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
}: {
  streak: number
  streakSecured: boolean
}) {
  return (
    <IslandStat
      label="Streak"
      meter={<StreakGauge streak={streak} atRisk={!streakSecured} />}
    />
  )
}

function RewardPoolRegion({
  rewardPoolCredits,
  rewardPoolMax,
  isOpen,
}: {
  rewardPoolCredits: number
  rewardPoolMax: number
  isOpen: boolean
}) {
  const poolLeft = Math.max(0, Math.min(rewardPoolMax, rewardPoolCredits))

  return (
    <IslandStat
      label="Stok reward"
      meter={
        <ProgressBar
          value={poolLeft}
          max={rewardPoolMax}
          valueText={`${formatCredits(poolLeft)} dari ${formatCredits(rewardPoolMax)} credit stok reward tersisa`}
          accentSweep={isOpen}
        />
      }
    />
  )
}

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
  return (
    <IslandStat
      label="Energi"
      meter={
        <EnergyPips
          energy={energy}
          max={energyMax}
          fraction={fill.fraction}
          accentSweep={isOpen}
        />
      }
    />
  )
}
