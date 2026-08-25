'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { maxEnergy } from '@/domain/energy'
import type { Referral, ReferralSummary } from '@/features/referral/domain'
import type { Withdrawal, WithdrawalDraft } from '@/features/withdraw/domain'
import { useViewStack } from '@/navigation/use-view-stack'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import { useAdPass } from '@/shell/use-ad-pass'
import { useEnergyProjection } from '@/shell/use-energy-projection'
import { useRewardPoolProjection } from '@/shell/use-reward-pool-projection'
import { useSessionQueries } from '@/shell/use-session-queries'
import { useTaskFlow } from '@/shell/use-task-flow'

export function useRewardSession({ onError }: { onError: (message: string) => void }) {
  const {
    view,
    depth: viewDepth,
    push: pushView,
    back: goBack,
    select: selectView,
  } = useViewStack()
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  const notifyError = useCallback((message: string) => onErrorRef.current(message), [])

  const {
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
  } = useSessionQueries(view)

  const retrySession = useCallback(() => {
    void mutateSession()
  }, [mutateSession])

  const { energy, energySecondsToNext } = useEnergyProjection({
    payload: session?.energy ?? null,
    refreshSession: retrySession,
  })

  const {
    rewardPoolCredits,
    rewardPoolMax,
    rewardPoolRegenCredits,
    rewardPoolSecondsToNext,
  } = useRewardPoolProjection({
    payload: session?.rewardPool ?? null,
    refreshSession: retrySession,
  })

  const task = taskData?.challenge ?? null

  const {
    activeChallenge,
    taskElapsedMs,
    startingTask,
    submitting,
    startTask,
    completeTask,
    nextTask,
  } = useTaskFlow({
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
  })

  const { watchAd, watchingAd, hasPass } = useAdPass({
    ads: session?.ads ?? null,
    notifyError,
    refreshSession: mutateSession,
  })

  const startTaskWithAd = useCallback(async () => {
    if (!hasPass && !(await watchAd())) return
    startTask('ad')
  }, [hasPass, startTask, watchAd])

  const history = useMemo(
    () => (historyPages ?? []).flatMap((page) => page.entries),
    [historyPages],
  )
  const lastHistoryPage = historyPages?.[historyPages.length - 1]
  const hasMoreHistory = Boolean(lastHistoryPage && lastHistoryPage.nextCursor !== null)
  const loadingMoreHistory =
    historySize > 0 && historyPages !== undefined && historyPages[historySize - 1] === undefined
  const loadMoreHistory = useCallback(() => {
    void setHistorySize((size) => size + 1)
  }, [setHistorySize])
  const withdrawals = payoutData?.withdrawals ?? []
  const referrals: Referral[] = useMemo(
    () =>
      (referralData?.downlines ?? []).map((item) => ({
        id: item.id,
        name: item.displayName,
        joinedAt: item.joinedAt,
        tasksCompleted: item.taskCount,
        commissionUnits: item.commissionUnits,
        lastTaskAt: item.lastActiveAt,
      })),
    [referralData],
  )
  const settledReferralCredits = session?.breakdown?.referralCredits ?? 0
  const referralSummary: ReferralSummary = useMemo(
    () => ({
      credits: settledReferralCredits,
      pendingUnits: referralData?.pendingUnits ?? 0,
    }),
    [referralData, settledReferralCredits],
  )

  const submitWithdrawal = useCallback(
    async (draft: Omit<WithdrawalDraft, 'amount'> & { credits: number }) => {
      try {
        const result = await sendJson<{ withdrawal: Withdrawal; balance: number }>(
          '/api/withdrawals',
          'POST',
          draft,
        )
        await Promise.all([mutateSession(), mutatePayouts(), mutateStats()])
        return result.withdrawal
      } catch (error) {
        notifyError(userFacingMessage(error))
        return null
      }
    },
    [mutatePayouts, mutateSession, mutateStats, notifyError],
  )

  const openHistory = useCallback(() => pushView('history'), [pushView])
  const openReferral = useCallback(() => {
    void mutateReferral()
    pushView('referral')
  }, [mutateReferral, pushView])

  return {
    view,
    viewDepth,
    loading: session === undefined && !sessionError,
    sessionFailed: Boolean(sessionError) && session === undefined,
    unauthenticated: session !== undefined && !session.user,
    retrySession,
    retryingSession: sessionValidating,
    botAppUrl: session?.botAppUrl ?? null,
    error: sessionError || taskError ? userFacingMessage(sessionError ?? taskError) : null,
    user: session?.user ?? null,
    openHistory,
    openReferral,
    goBack,
    selectView,
    exitTask: goBack,
    balance: session?.user?.balance ?? 0,
    taskBalance: session?.breakdown?.taskCredits ?? 0,
    referralCredits: settledReferralCredits,
    withdrawnCredits: payoutData?.totals.withdrawnCredits ?? session?.breakdown?.withdrawnCredits ?? 0,
    processingCredits: payoutData?.totals.processingCredits ?? 0,
    withdrawals,
    withdrawalEligibility: payoutData?.eligibility ?? null,
    referrals,
    referralSummary,
    referralCode: referralData?.code ?? session?.user?.referralCode ?? '',
    referralShareUrl: referralData?.shareUrl ?? '',
    history,
    hasMoreHistory,
    loadingMoreHistory,
    loadMoreHistory,
    stats: statsData?.stats ?? null,
    leaderboard: leaderboardData?.board ?? null,
    completedCount: statsData?.stats.completedCount ?? 0,
    task,
    activeChallenge,
    taskElapsedMs,
    submitting,
    startingTask,
    energy,
    energyMax: maxEnergy(),
    energySecondsToNext,
    rewardPoolCredits,
    rewardPoolMax,
    rewardPoolRegenCredits,
    rewardPoolSecondsToNext,
    startTask,
    startTaskWithAd,
    adsEnabled: session?.ads?.enabled ?? false,
    adViewsLeft: session?.ads?.viewsLeft ?? 0,
    adCooldownSecondsLeft: session?.ads?.cooldownSecondsLeft ?? 0,
    adPassReady: hasPass,
    watchingAd,
    completeTask,
    nextTask,
    submitWithdrawal,
  }
}
