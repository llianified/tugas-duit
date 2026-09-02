'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Difficulty } from '@/domain/task/challenge'
import type { EnergyFill } from '@/domain/economy/energy'
import { getStarReward } from '@/domain/progression/stars'
import { DifficultyIsland } from '@/features/home/difficulty-island'
import type { Progression } from '@/domain/progression/progression'
import { ProfileIsland } from '@/features/home/profile-island'
import { RankIsland } from '@/features/home/rank-island'
import type { UserStats } from '@/domain/progression/stats'
import type { PremiumState, SessionResponse } from '@/shell/session-api'

export function ProgressionBadges({
  progression,
  user = null,
  stats = null,
  premium = null,
  showProfile = false,
  taskDifficulty = null,
  taskReward = null,
  energy,
  energyMax,
  energyFill,
  rewardPoolCredits,
  rewardPoolMax,
  rewardPoolRegenCredits,
  rewardPoolSecondsToNext,
  onOpenStats,
}: {
  progression: Progression
  user?: SessionResponse['user']
  stats?: UserStats | null
  premium?: PremiumState | null
  showProfile?: boolean
  taskDifficulty?: Difficulty | null
  taskReward?: number | null
  energy: number
  energyMax: number
  energyFill: EnergyFill
  rewardPoolCredits: number | null
  rewardPoolMax: number | null
  rewardPoolRegenCredits: number | null
  rewardPoolSecondsToNext: number | null
  onPanelOpenChange?: (open: boolean) => void
  onOpenStats?: () => void
}) {
  const [openPanel, setOpenPanel] = useState<'profile' | 'rank' | 'difficulty' | null>(null)
  const closePanel = useCallback(() => setOpenPanel(null), [])
  const profileVisible = showProfile && user !== null && stats !== null
  const profileOpen = openPanel === 'profile'
  const rankOpen = openPanel === 'rank'
  const difficultyOpen = openPanel === 'difficulty'

  useEffect(() => {
    if (!profileVisible) setOpenPanel((current) => (current === 'profile' ? null : current))
  }, [profileVisible])

  useEffect(() => {
    if (!taskDifficulty) setOpenPanel((current) => (current === 'difficulty' ? null : current))
  }, [taskDifficulty])

  return (
    <>
      {profileVisible ? (
        <ProfileIsland
          onOpenStats={onOpenStats}
          user={user}
          stats={stats}
          premium={premium}
          isOpen={profileOpen}
          promoted={openPanel !== null}
          onToggle={() => setOpenPanel(profileOpen ? null : 'profile')}
          onClose={closePanel}
        />
      ) : null}

      <RankIsland
        progression={progression}
        energy={energy}
        energyMax={energyMax}
        energyFill={energyFill}
        rewardPoolCredits={rewardPoolCredits}
        rewardPoolMax={rewardPoolMax}
        rewardPoolRegenCredits={rewardPoolRegenCredits}
        rewardPoolSecondsToNext={rewardPoolSecondsToNext}
        isOpen={rankOpen}
        slideOutTo={profileOpen ? 'right' : difficultyOpen ? 'left' : undefined}
        onToggle={() => setOpenPanel(rankOpen ? null : 'rank')}
        onClose={closePanel}
      />

      {taskDifficulty ? (
        <DifficultyIsland
          difficulty={taskDifficulty}
          reward={taskReward ?? getStarReward(taskDifficulty, 3)}
          isOpen={difficultyOpen}
          slideOutTo={profileOpen || rankOpen ? 'right' : undefined}
          onToggle={() => setOpenPanel(difficultyOpen ? null : 'difficulty')}
          onClose={closePanel}
        />
      ) : null}
    </>
  )
}
