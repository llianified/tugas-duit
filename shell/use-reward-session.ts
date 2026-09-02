'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { maxEnergy } from '@/domain/economy/energy'
import type { Referral, ReferralSummary } from '@/domain/economy/referral'
import type { Withdrawal, WithdrawalDraft } from '@/domain/economy/withdrawal'
import { useViewStack } from '@/navigation/use-view-stack'
import { rememberAdsHint } from '@/shell/ads-hint'
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
    activityData,
    referralData,
    mutateReferral,
    payoutData,
    mutatePayouts,
  } = useSessionQueries(view)

  const retrySession = useCallback(() => {
    void mutateSession()
  }, [mutateSession])

  const premiumActive = session?.premium?.active ?? false

  const { energy, energySecondsToNext, energyFill } = useEnergyProjection({
    payload: session?.energy ?? null,
    premium: premiumActive,
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
    void startTask('ad')
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

  /** Dicatat supaya kerangka pemuatan pada pembukaan BERIKUTNYA menggambar jumlah tombol yang benar di kartu task. Hanya petunjuk bentuk; keputusan sebenarnya tetap dari `session.ads.enabled` di render ini. */
  const adsEnabled = session?.ads?.enabled ?? false
  useEffect(() => {
    if (session === undefined) return
    rememberAdsHint(adsEnabled)
  }, [adsEnabled, session])

  const openHistory = useCallback(() => pushView('history'), [pushView])
  const openMissions = useCallback(() => pushView('missions'), [pushView])
  const openProfile = useCallback(() => pushView('profile'), [pushView])
  const openStats = useCallback(() => pushView('stats'), [pushView])
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
    founder: session?.user?.founder ?? false,
    openHistory,
    openMissions,
    openProfile,
    openStats,
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
    activity: activityData?.entries ?? null,
    completedCount: statsData?.stats.completedCount ?? 0,
    task,
    activeChallenge,
    taskElapsedMs,
    submitting,
    startingTask,
    energy,
    energyMax: maxEnergy(premiumActive),
    energySecondsToNext,
    energyFill,
    rewardPoolCredits,
    rewardPoolMax,
    rewardPoolRegenCredits,
    rewardPoolSecondsToNext,
    startTask,
    startTaskWithAd,
    premium: session?.premium ?? null,
    channelBonus: session?.channelBonus ?? null,
    channelGate: session?.channelGate ?? null,
    channelBlocked: Boolean(session?.channelGate?.required && !session.channelGate.member),
    refreshSession: mutateSession,
    adsEnabled,
    inAppAdsEnabled: session?.ads?.inAppEnabled ?? false,
    adViewsLeft: session?.ads?.viewsLeft ?? 0,
    adCooldownSecondsLeft: session?.ads?.cooldownSecondsLeft ?? 0,
    adPassReady: hasPass,
    watchingAd,
    completeTask,
    nextTask,
    submitWithdrawal,
  }
}
