'use client'

import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'
import { leaderboardEnabled } from '@/features/leaderboard/availability'
import type { AppView } from '@/navigation/app-view'
import { fetchJson } from '@/shell/api-client'
import {
  loadSession,
  type HistoryResponse,
  type ActivityResponse,
  type LeaderboardResponse,
  type MissionsResponse,
  type ReferralResponse,
  type StatsResponse,
  type TaskResponse,
  type WithdrawalsResponse,
} from '@/shell/session-api'

/** Jeda polling umpan aktivitas, dan angkanya terikat plafon `/api/activity` — bukan selera. Lima belas detik berarti 240 permintaan per jam melawan plafon yang saat itu 120, jadi user yang membuka tab Peringkat lebih dari setengah jam mendapat 429 dan umpannya berhenti hidup tanpa pesan apa pun. Tiga puluh detik = 120 permintaan per jam, dan plafon route-nya dinaikkan ke 200 supaya `revalidateOnFocus` serta pemasangan ulang komponen punya sisa. Menaikkan salah satunya tanpa yang lain mengembalikan bug yang sama; `tests/rate-budget.test.ts` yang menahannya. */
const ACTIVITY_POLL_MS = 30_000

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
  const {
    data: missionsData,
    error: missionsError,
    mutate: mutateMissions,
  } = useSWR<MissionsResponse>(authenticated ? '/api/missions' : null, fetchJson)
  // Umpan aktivitas global milik semua user, jadi ia bergerak walau user ini diam — | polling-nya yang bikin tab Aktivitas terasa hidup, bukan aksi user sendiri. | Interval hanya jalan selagi tab papan peringkat kebuka, dan `refreshWhenHidden` | dibiarkan mati supaya app yang di-background tidak menembaki API tanpa penonton. | `leaderboardEnabled()` ikut menjaganya, sama seperti papan di bawah: umpan ini | bagian dari view Peringkat, dan tanpa penjaga itu ia tetap dipoll tiap interval | di belakang layar "segera hadir" — permintaan berkala untuk fitur yang sedang | dimatikan, dan sejak route-nya ikut dijaga ia cuma memanen 404.
  const { data: activityData } = useSWR<ActivityResponse>(
    leaderboardEnabled() && authenticated && view === 'leaderboard' ? '/api/activity' : null,
    fetchJson,
    {
      revalidateOnFocus: true,
      refreshInterval: ACTIVITY_POLL_MS,
      refreshWhenHidden: false,
      keepPreviousData: true,
    },
  )
  const { data: leaderboardData } = useSWR<LeaderboardResponse>(
    leaderboardEnabled() && authenticated && view === 'leaderboard' ? '/api/leaderboard' : null,
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
    missionsData,
    missionsError,
    mutateMissions,
    leaderboardData,
    activityData,
    referralData,
    mutateReferral,
    payoutData,
    mutatePayouts,
  }
}
