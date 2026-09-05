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

export function useSessionQueries(view: AppView, withdrawalsPrimed: boolean) {
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
  /** Panel referral berikut `shareUrl`-nya cuma dibaca dua view, tapi sebelumnya ditarik di tiap
   * boot dan tiap fokus — 28K permintaan per 12 jam di Observability untuk layar yang mayoritas
   * user tidak pernah buka. `view === 'missions'` ikut karena misi berbagi bocorannya: kartu misi
   * sosial menyusun teks bagikannya dari `referralShareUrl`, dan itu satu-satunya sumbernya.
   * `referralCode` tidak ikut menunggu — ia sudah punya jalur cadangan dari payload sesi. */
  const { data: referralData, mutate: mutateReferral } = useSWR<ReferralResponse>(
    authenticated && (view === 'referral' || view === 'missions') ? '/api/referral' : null,
    fetchJson,
    { keepPreviousData: true },
  )
  /** Daftar penarikan tidak pernah dibaca di beranda: yang memakainya cuma tiga view di dalam nav
   * dan dialog tarik — dan dialog itu dibuka dengan ketukan, bukan saat boot. Sebelumnya ia ikut
   * ditarik di tiap boot dan tiap fokus, 18K permintaan per 12 jam melawan 4,5K halaman dibuka.
   * `withdrawalsPrimed` sekali menyala tidak dimatikan lagi: yang dihindari cuma permintaan pertama
   * sebelum ada yang membutuhkannya, dan mematikannya lagi hanya membuat dialog yang ditutup lalu
   * dibuka ulang menembak dua kali. `withdrawnCredits` tidak menunggu ini — ia punya jalur cadangan
   * dari `breakdown` di payload sesi; `processingCredits` yang tidak punya, dan ketiga view itulah
   * satu-satunya pembacanya. */
  const { data: payoutData, mutate: mutatePayouts } = useSWR<WithdrawalsResponse>(
    authenticated &&
      (withdrawalsPrimed || view === 'history' || view === 'stats' || view === 'profile')
      ? '/api/withdrawals'
      : null,
    fetchJson,
    { keepPreviousData: true },
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
