'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyedMutator } from 'swr'
import type { SWRInfiniteKeyedMutator } from 'swr/infinite'
import type { Challenge, TaskSubmission } from '@/features/captcha/domain'
import type { AppView } from '@/navigation/app-view'
import { ApiError, sendJson, userFacingMessage } from '@/shell/api-client'
import type {
  HistoryResponse,
  ReferralResponse,
  SessionResponse,
  StartTaskResponse,
  StatsResponse,
  SubmitResponse,
  TaskResponse,
} from '@/shell/session-api'
import { formatCountdown } from '@/shared/lib/format'

export function useTaskFlow({
  view,
  task,
  energy,
  energySecondsToNext,
  rewardPoolCredits,
  rewardPoolSecondsToNext,
  notifyError,
  selectView,
  goBack,
  mutateSession,
  mutateTask,
  mutateHistory,
  mutateStats,
  mutateReferral,
}: {
  view: AppView
  task: Challenge | null
  energy: number
  energySecondsToNext: number | null
  rewardPoolCredits: number | null
  rewardPoolSecondsToNext: number | null
  notifyError: (message: string) => void
  selectView: (view: AppView) => void
  goBack: () => void
  mutateSession: KeyedMutator<SessionResponse>
  mutateTask: KeyedMutator<TaskResponse>
  mutateHistory: SWRInfiniteKeyedMutator<HistoryResponse[]>
  mutateStats: KeyedMutator<StatsResponse>
  mutateReferral: KeyedMutator<ReferralResponse>
}) {
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [taskElapsedMs, setTaskElapsedMs] = useState(0)
  const [startingTask, setStartingTask] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const beginChallenge = useCallback(
    async (candidate: Challenge) => {
      const started = await sendJson<StartTaskResponse>('/api/task/start', 'POST', {
        challengeId: candidate.id,
      })
      setTaskElapsedMs(started.elapsedMs)
      setActiveChallenge(started.challenge)
      void mutateSession(
        (previous) =>
          previous
            ? { ...previous, energy: { ...started.energy, receivedAt: Date.now() } }
            : previous,
        { revalidate: false },
      )
    },
    [mutateSession],
  )

  const startTask = useCallback(() => {
    if (!task || startingTask) return
    if (energy < 1) {
      notifyError(
        energySecondsToNext === null
          ? 'Energi kamu habis. Tunggu energi berikutnya ya.'
          : `Energi habis. Energi berikutnya dalam ${formatCountdown(energySecondsToNext)}.`,
      )
      return
    }
    if (rewardPoolCredits === 0) {
      notifyError(
        rewardPoolSecondsToNext === null
          ? 'Kolam reward kamu kosong. Tunggu terisi lagi ya, energi kamu tidak terpakai.'
          : `Kolam reward kamu kosong. Isi berikutnya dalam ${formatCountdown(rewardPoolSecondsToNext)}, energi kamu tidak terpakai.`,
      )
      return
    }
    setStartingTask(true)
    void (async () => {
      try {
        try {
          await beginChallenge(task)
        } catch (cause) {
          if (cause instanceof ApiError && cause.code !== 'CHALLENGE_NOT_STARTABLE') throw cause
          const refreshed = (await mutateTask())?.challenge
          if (!refreshed || refreshed.id === task.id) throw cause
          await beginChallenge(refreshed)
        }
        selectView('captcha')
      } catch (cause) {
        notifyError(userFacingMessage(cause))
        if (
          cause instanceof ApiError &&
          (cause.code === 'ENERGY_EMPTY' || cause.code === 'REWARD_POOL_EMPTY')
        )
          void mutateSession()
      } finally {
        setStartingTask(false)
      }
    })()
  }, [
    beginChallenge,
    rewardPoolCredits,
    rewardPoolSecondsToNext,
    energy,
    energySecondsToNext,
    mutateSession,
    mutateTask,
    notifyError,
    selectView,
    startingTask,
    task,
  ])

  const completeTask = useCallback(
    async (answer: string): Promise<TaskSubmission | null> => {
      if (!activeChallenge || submitting) return null
      setSubmitting(true)
      try {
        const result = await sendJson<SubmitResponse>('/api/task/submit', 'POST', {
          challengeId: activeChallenge.id,
          answer,
        })
        if (!result.ok) {
          return result.reason === 'wrong' && result.attemptsLeft !== undefined
            ? { attemptsLeft: result.attemptsLeft }
            : null
        }

        const outcome: TaskSubmission = {
          challenge: activeChallenge,
          elapsedMs: result.elapsedMs,
          stars: result.stars,
          reward: result.reward,
        }
        await Promise.all([
          mutateSession(),
          mutateHistory(),
          mutateStats(),
          mutateReferral(),
          mutateTask(),
        ])
        return outcome
      } catch (error) {
        throw error
      } finally {
        setSubmitting(false)
      }
    },
    [activeChallenge, submitting, mutateHistory, mutateReferral, mutateSession, mutateStats, mutateTask],
  )

  const nextTask = useCallback(async () => {
    const next = (await mutateTask())?.challenge ?? null
    if (!next) {
      setActiveChallenge(null)
      return
    }
    try {
      await beginChallenge(next)
    } catch (cause) {
      notifyError(userFacingMessage(cause))
      setActiveChallenge(null)
    }
  }, [beginChallenge, mutateTask, notifyError])

  const visitedCaptcha = useRef(false)
  useEffect(() => {
    if (view === 'captcha') {
      visitedCaptcha.current = true
      if (!activeChallenge) goBack()
      return
    }
    if (!visitedCaptcha.current) return
    visitedCaptcha.current = false
    if (activeChallenge) setActiveChallenge(null)
  }, [view, activeChallenge, goBack])

  return {
    activeChallenge,
    taskElapsedMs,
    startingTask,
    submitting,
    startTask,
    completeTask,
    nextTask,
  }
}
