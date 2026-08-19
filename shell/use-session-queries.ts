'use client'

import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'
import { LEADERBOARD_ENABLED } from '@/features/leaderboard/availability'
import type { AppView } from '@/navigation/app-view'
import { fetchJson } from '@/shell/api-client'
import {
  loadSession,
  type HistoryResponse,
  type LeaderboardResponse,
  type ReferralResponse,
  type StatsResponse,
  type TaskResponse,
  type WithdrawalsResponse,
} from '@/shell/session-api'

export function useSessionQueries(view: AppView) {
  const {
    data: session,
    error: sessionError,
    isValidating: sessionValidating,
    mutate: mutateSession,
  } = useSWR('/api/session', loadSession, { revalidateOnFocus: true })
  const authenticated = Boolean(session?.user)
  const { data: taskData, error: taskError, mutate: mutateTask } = useSWR<TaskResponse>(
    authenticated ? '/api/task' : null,
    fetchJson,
  )
  const {
    data: historyPages,
    size: historySize,
    setSize: setHistorySize,
    mutate: mutateHistory,
  } = useSWRInfinite<HistoryResponse>(
    (index, previous: HistoryResponse | null) => {
      if (!authenticated) return null
      if (previous && previous.nextCursor === null) return null
      if (index === 0) return '/api/history'
      return `/api/history?cursor=${previous?.nextCursor}`
    },
    fetchJson,
    { revalidateOnFocus: false, revalidateFirstPage: false },
  )
  const { data: statsData, mutate: mutateStats } = useSWR<StatsResponse>(
    authenticated ? '/api/stats' : null,
    fetchJson,
  )
  const { data: leaderboardData } = useSWR<LeaderboardResponse>(
    LEADERBOARD_ENABLED && authenticated && view === 'leaderboard' ? '/api/leaderboard' : null,
    fetchJson,
    { revalidateOnFocus: false },
  )
  const { data: referralData, mutate: mutateReferral } = useSWR<ReferralResponse>(
    authenticated ? '/api/referral' : null,
    fetchJson,
  )
  const { data: payoutData, mutate: mutatePayouts } = useSWR<WithdrawalsResponse>(
    authenticated ? '/api/withdrawals' : null,
    fetchJson,
  )
  return {
    session,
    sessionError,
    sessionValidating,
    mutateSession,
    taskData,
    taskError,
    mutateTask,
    historyPages,
    historySize,
    setHistorySize,
    mutateHistory,
    statsData,
    mutateStats,
    leaderboardData,
    referralData,
    mutateReferral,
    payoutData,
    mutatePayouts,
  }
}
