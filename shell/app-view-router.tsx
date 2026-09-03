'use client'

import { ActionButton } from '@/shared/components/action-button'
import {
  AppViewSkeleton,
  LeaderboardSkeleton,
  ProfileSkeleton,
  StatsSkeleton,
} from '@/shared/components/app-skeleton'
import { CaptchaView } from '@/features/captcha/components/captcha'
import type { Challenge } from '@/domain/task/challenge'
import { HistoryView } from '@/features/history/history'
import { HomeView } from '@/features/home/home'
import { leaderboardEnabled } from '@/features/leaderboard/availability'
import { LeaderboardComingSoon, LeaderboardView } from '@/features/leaderboard/leaderboard'
import { MissionsView } from '@/features/missions/missions'
import { ProfileView } from '@/features/profile/profile'
import { ReferralView } from '@/features/referral/referral'
import { StatsView } from '@/features/stats/stats'
import type { AppView } from '@/navigation/app-view'
import type { useRewardSession } from '@/shell/use-reward-session'

type RewardSession = ReturnType<typeof useRewardSession>

export function AppViewRouter({
  session,
  activeChallenge,
  effectiveView,
  showError,
  onTaskRewardChange,
}: {
  session: RewardSession
  activeChallenge: Challenge | null
  effectiveView: AppView
  showError: (message: string) => void
  onTaskRewardChange: (reward: number) => void
}) {
  if (session.loading) return <AppViewSkeleton />

  if (session.sessionFailed) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="font-sans text-xl font-semibold text-foreground">Datanya nggak kebuka</h1>
        <ActionButton
          className="mt-1 max-w-xs"
          onClick={session.retrySession}
          disabled={session.retryingSession}
        >
          {session.retryingSession ? 'Memuat…' : 'Coba lagi'}
        </ActionButton>
      </section>
    )
  }

  if (session.unauthenticated) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="font-sans text-xl font-semibold text-foreground">Buka lewat Telegram</h1>
        {session.botAppUrl ? (
          <a
            href={session.botAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring transition-ui rounded-lg px-3 py-2 text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary-hover active:text-primary-active"
          >
            Buka di Telegram
          </a>
        ) : null}
      </section>
    )
  }

  if (effectiveView === 'captcha' && activeChallenge) {
    return (
      <CaptchaView
        key={activeChallenge.id}
        challenge={activeChallenge}
        balance={session.balance}
        rewardPoolCredits={session.rewardPoolCredits}
        elapsedMs={session.taskElapsedMs}
        onSuccess={session.completeTask}
        onNext={session.nextTask}
        onExit={session.exitTask}
        onError={showError}
        onRewardChange={onTaskRewardChange}
        turboRewardEnabled={session.economy.turboRewardEnabled === 1}
      />
    )
  }

  if (effectiveView === 'history') {
    return (
      <HistoryView
        key="history"
        history={session.history}
        completedCount={session.completedCount}
        totalCredits={session.stats?.taskCredits ?? 0}
        hasMore={session.hasMoreHistory}
        loadingMore={session.loadingMoreHistory}
        onLoadMore={session.loadMoreHistory}
        withdrawals={session.withdrawals}
        withdrawnCredits={session.withdrawnCredits}
        processingCredits={session.processingCredits}
      />
    )
  }

  if (effectiveView === 'missions') {
    return (
      <MissionsView
        key="missions"
        refreshKey={session.completedCount}
        onClaimed={session.refreshSession}
      />
    )
  }

  if (effectiveView === 'referral') {
    return (
      <ReferralView
        key="referral"
        referrals={session.referrals}
        summary={session.referralSummary}
        code={session.referralCode}
        shareUrl={session.referralShareUrl}
        earnedCredits={session.taskBalance + session.referralCredits}
      />
    )
  }

  if (effectiveView === 'profile') {
    if (!session.stats || !session.user) return <ProfileSkeleton />
    return (
      <ProfileView
        key="profile"
        user={session.user}
        stats={session.stats}
        premium={session.premium}
        founder={session.founder}
        onOpenPhotoNote={() =>
          showError('Foto dan nama ikut Telegram. Ubah di sana, lalu buka ulang app.')
        }
      />
    )
  }

  if (effectiveView === 'stats') {
    if (!session.stats) return <StatsSkeleton key="stats" />
    return <StatsView key="stats" stats={session.stats} />
  }

  if (effectiveView === 'leaderboard') {
    if (!leaderboardEnabled()) return <LeaderboardComingSoon key="leaderboard" />
    if (!session.leaderboard) return <LeaderboardSkeleton key="leaderboard" />
    return (
      <LeaderboardView
        key="leaderboard"
        board={session.leaderboard}
        activity={session.activity}
      />
    )
  }

  if (!session.task) {
    return <AppViewSkeleton />
  }

  return (
    <HomeView
      key="home"
      balance={session.balance}
      taskBalance={session.taskBalance}
      referralCredits={session.referralCredits}
      withdrawnCredits={session.withdrawnCredits}
      history={session.history}
      task={session.task}
      energy={session.energy}
      energyMax={session.energyMax}
      energyFill={session.energyFill}
      rewardPoolCredits={session.rewardPoolCredits}
      rewardPoolMax={session.rewardPoolMax}
      rewardPoolRegenCredits={session.rewardPoolRegenCredits}
      rewardPoolSecondsToNext={session.rewardPoolSecondsToNext}
      economy={session.economy}
      adsEnabled={session.adsEnabled}
      adViewsLeft={session.adViewsLeft}
      adCooldownSecondsLeft={session.adCooldownSecondsLeft}
      adPassReady={session.adPassReady}
      watchingAd={session.watchingAd}
      onStart={(hold) => session.startTask('energy', hold)}
      onStartWithAd={session.startTaskWithAd}
      withdrawals={session.withdrawals}
      withdrawalEligibility={session.withdrawalEligibility}
      onSubmitWithdrawal={session.submitWithdrawal}
      onOpenHistory={session.openHistory}
      onOpenMissions={session.openMissions}
      premium={session.premium}
      channelBonus={session.channelBonus}
      onRefreshSession={session.refreshSession}
    />
  )
}
