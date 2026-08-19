'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Difficulty } from '@/features/captcha/domain'
import { getStarReward } from '@/domain/stars'
import { DifficultyIsland } from '@/features/home/difficulty-island'
import type { Progression } from '@/features/home/progression'
import { RankIsland } from '@/features/home/rank-island'

export function ProgressionBadges({
  progression,
  taskDifficulty = null,
  taskReward = null,
  energy,
  energyMax,
  energySecondsToNext,
  rewardPoolCredits,
  rewardPoolMax,
  rewardPoolRegenCredits,
  rewardPoolSecondsToNext,
  onPanelOpenChange,
}: {
  progression: Progression
  taskDifficulty?: Difficulty | null
  taskReward?: number | null
  energy: number
  energyMax: number
  energySecondsToNext: number | null
  rewardPoolCredits: number | null
  rewardPoolMax: number | null
  rewardPoolRegenCredits: number | null
  rewardPoolSecondsToNext: number | null
  onPanelOpenChange?: (open: boolean) => void
}) {
  const [openPanel, setOpenPanel] = useState<'rank' | 'difficulty' | null>(null)
  const closePanel = useCallback(() => setOpenPanel(null), [])
  const rankOpen = openPanel === 'rank'
  const difficultyOpen = openPanel === 'difficulty'

  useEffect(() => {
    onPanelOpenChange?.(openPanel !== null)
  }, [openPanel, onPanelOpenChange])

  return (
    <>
      <RankIsland
        progression={progression}
        energy={energy}
        energyMax={energyMax}
        energySecondsToNext={energySecondsToNext}
        rewardPoolCredits={rewardPoolCredits}
        rewardPoolMax={rewardPoolMax}
        rewardPoolRegenCredits={rewardPoolRegenCredits}
        rewardPoolSecondsToNext={rewardPoolSecondsToNext}
        isOpen={rankOpen}
        slideOutTo={difficultyOpen ? 'left' : undefined}
        onToggle={() => setOpenPanel(rankOpen ? null : 'rank')}
        onClose={closePanel}
      />

      {taskDifficulty ? (
        <DifficultyIsland
          difficulty={taskDifficulty}
          reward={taskReward ?? getStarReward(taskDifficulty, 3)}
          isOpen={difficultyOpen}
          slideOutTo={rankOpen ? 'right' : undefined}
          onToggle={() => setOpenPanel(difficultyOpen ? null : 'difficulty')}
          onClose={closePanel}
        />
      ) : null}
    </>
  )
}
