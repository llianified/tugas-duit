'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyedMutator } from 'swr'
import type { SWRInfiniteKeyedMutator } from 'swr/infinite'
import { energyCostPerTask } from '@/domain/economy/energy'
import type { Challenge, TaskSubmission } from '@/domain/task/challenge'
import type { AppView } from '@/navigation/app-view'
import { ApiError, sendJson, userFacingMessage } from '@/shell/api-client'
import type {
  HistoryResponse,
  ReferralResponse,
  SessionResponse,
  StartTaskResponse,
  StatsResponse,
  SubmitResponse,
  TaskPayment,
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
    async (candidate: Challenge, payWith: TaskPayment = 'energy') => {
      const sentAt = performance.now()
      const started = await sendJson<StartTaskResponse>('/api/task/start', 'POST', {
        challengeId: candidate.id,
        payWith,
      })
      setTaskElapsedMs(started.elapsedMs + (performance.now() - sentAt))
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

  /** Ongkos masuk yang pasti ditolak server, dijawab di klien supaya alasannya terbaca di tempat. `null` berarti boleh jalan. Task yang sudah pernah dimulai tidak menagih apa pun lagi — `startChallenge` memungut ongkosnya hanya di dalam cabang `fresh` — jadi melanjutkan selalu lolos. Dipakai dua pemanggil: "Mulai" di beranda dan "Lanjut" di layar hasil. */
  const entryRefusal = useCallback(
    (candidate: Challenge, payWith: TaskPayment): string | null => {
      if (candidate.startedAt !== null) return null
      /** Ambangnya `energyCostPerTask()`, bukan 1: biaya energi per task bisa disetel dari panel admin, dan `< 1` membuat klien meloloskan permintaan yang pasti ditolak server begitu biayanya dinaikkan. Bentuknya sama dengan `energyEmpty` di `active-task.tsx`. */
      if (payWith === 'energy' && energy < energyCostPerTask()) {
        return energySecondsToNext === null
          ? 'Energi belum cukup. Tunggu isi berikutnya.'
          : `Energi belum cukup. Isi lagi dalam ${formatCountdown(energySecondsToNext)}.`
      }
      if (rewardPoolCredits === 0) {
        return rewardPoolSecondsToNext === null
          ? 'Stok reward kosong. Tunggu terisi lagi. Tiket dan energi tetap aman.'
          : `Stok reward kosong. Terisi lagi dalam ${formatCountdown(rewardPoolSecondsToNext)}. Tiket dan energi tetap aman.`
      }
      return null
    },
    [energy, energySecondsToNext, rewardPoolCredits, rewardPoolSecondsToNext],
  )

  /** `hold` datang dari animasi sobekan karcis di beranda (`ActiveTask`). Permintaan ke server dan animasinya jalan BERBARENGAN; yang ditunggu di sini hanya sisa waktu animasi setelah server menjawab, jadi ketukan tidak pernah jadi lebih lambat dari salah satu di antaranya. Kembaliannya dipakai pemanggil untuk memulihkan karcis kalau task gagal dimulai. */
  const startTask = useCallback(
    async (payWith: TaskPayment = 'energy', hold?: Promise<unknown>): Promise<boolean> => {
      if (!task || startingTask) return false
      const refusal = entryRefusal(task, payWith)
      if (refusal) {
        notifyError(refusal)
        return false
      }
      setStartingTask(true)
      try {
        try {
          await beginChallenge(task, payWith)
        } catch (cause) {
          if (!(cause instanceof ApiError) || cause.code !== 'CHALLENGE_NOT_STARTABLE') throw cause
          const refreshed = (await mutateTask())?.challenge
          if (!refreshed || refreshed.id === task.id) throw cause
          await beginChallenge(refreshed, payWith)
        }
        /** Server sudah oke; sisa waktu animasi sobekan dihabiskan di sini supaya halaman task tidak muncul di tengah kertas yang belum putus. */
        if (hold) await hold
        selectView('captcha')
        return true
      } catch (cause) {
        notifyError(userFacingMessage(cause))
        if (
          cause instanceof ApiError &&
          (cause.code === 'ENERGY_EMPTY' ||
            cause.code === 'REWARD_POOL_EMPTY' ||
            cause.code === 'AD_PASS_MISSING')
        )
          void mutateSession()
        return false
      } finally {
        setStartingTask(false)
      }
    },
    [
      beginChallenge,
      entryRefusal,
      mutateSession,
      mutateTask,
      notifyError,
      selectView,
      startingTask,
      task,
    ],
  )

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
      } finally {
        setSubmitting(false)
      }
    },
    [activeChallenge, submitting, mutateHistory, mutateReferral, mutateSession, mutateStats, mutateTask],
  )

  /** "Lanjut" di layar hasil membayar dengan energi, dan penjaganya dipakai ulang di sini bukan demi kerapian: user yang baru saja menyelesaikan task berbayar tiket justru sedang kehabisan energi, jadi tanpa pemeriksaan ini tombol utama layar kemenangan dijamin ditolak server lalu melempar mereka ke beranda dengan toast merah. Alasannya sekarang terbaca sebelum mereka pindah layar, dan tombol tiket di beranda tetap jalan keluarnya. */
  const nextTask = useCallback(async () => {
    const next = (await mutateTask())?.challenge ?? null
    if (!next) {
      setActiveChallenge(null)
      return
    }
    const refusal = entryRefusal(next, 'energy')
    if (refusal) {
      notifyError(refusal)
      setActiveChallenge(null)
      return
    }
    try {
      await beginChallenge(next)
    } catch (cause) {
      notifyError(userFacingMessage(cause))
      setActiveChallenge(null)
    }
  }, [beginChallenge, entryRefusal, mutateTask, notifyError])

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
