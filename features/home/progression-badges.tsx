'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Difficulty } from '@/features/captcha/domain'
import { getStarReward } from '@/domain/stars'
import { DifficultyIsland } from '@/features/home/difficulty-island'
import type { Progression } from '@/features/home/progression'
import { ProfileIsland } from '@/features/home/profile-island'
import { RankIsland } from '@/features/home/rank-island'
import type { UserStats } from '@/features/stats/domain'
import type { SessionResponse } from '@/shell/session-api'

export function ProgressionBadges({
  progression,
  user = null,
  stats = null,
  showProfile = false,
  onOpenStats,
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
  user?: SessionResponse['user']
  stats?: UserStats | null
  showProfile?: boolean
  onOpenStats?: () => void
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
  const [openPanel, setOpenPanel] = useState<'profile' | 'rank' | 'difficulty' | null>(null)
  const closePanel = useCallback(() => setOpenPanel(null), [])
  const profileVisible = showProfile && user !== null && stats !== null
  const profileOpen = openPanel === 'profile'
  const rankOpen = openPanel === 'rank'
  const difficultyOpen = openPanel === 'difficulty'

  useEffect(() => {
    onPanelOpenChange?.(openPanel !== null)
  }, [openPanel, onPanelOpenChange])

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
          user={user}
          stats={stats}
          isOpen={profileOpen}
          slideOutTo={rankOpen || difficultyOpen ? 'left' : undefined}
          onToggle={() => setOpenPanel(profileOpen ? null : 'profile')}
          onClose={closePanel}
          onOpenStats={() => {
            closePanel()
            onOpenStats?.()
          }}
        />
      ) : null}

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
