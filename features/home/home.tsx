'use client'

import { useState } from 'react'
import { ActiveTask } from '@/features/home/active-task'
import { BalanceSummary } from '@/features/home/balance-summary'
import { RecentTransactions } from '@/features/home/recent-transactions'
import type { Challenge, HistoryEntry } from '@/features/captcha/domain'
import { WithdrawDialog } from '@/features/withdraw/components/withdraw-dialog'
import type { WithdrawalSubmitInput } from '@/features/withdraw/components/withdraw-form'
import type { Withdrawal } from '@/features/withdraw/domain'

interface HomeViewProps {
  balance: number
  taskBalance: number
  referralCredits: number
  withdrawnCredits: number
  history: HistoryEntry[]
  completedCount: number
  task: Challenge
  energy: number
  energyMax: number
  energySecondsToNext: number | null
  rewardPoolCredits: number | null
  rewardPoolSecondsToNext: number | null
  adsEnabled: boolean
  adViewsLeft: number
  adCooldownSecondsLeft: number
  adPassReady: boolean
  watchingAd: boolean
  onStart: () => void
  onStartWithAd: () => void
  withdrawals: Withdrawal[]
  onSubmitWithdrawal: (input: WithdrawalSubmitInput) => Promise<Withdrawal | null>
  onOpenHistory: () => void
}

const ENTER_STEP_CLASS = ['enter-step-0', 'enter-step-1', 'enter-step-2'] as const

export function HomeView({
  balance,
  history,
  completedCount,
  task,
  energy,
  energyMax,
  energySecondsToNext,
  rewardPoolCredits,
  rewardPoolSecondsToNext,
  adsEnabled,
  adViewsLeft,
  adCooldownSecondsLeft,
  adPassReady,
  watchingAd,
  onStart,
  onStartWithAd,
  withdrawals,
  onSubmitWithdrawal,
  onOpenHistory,
}: HomeViewProps) {
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  return (
    <div className="view-min-h flex flex-col">
      <h1 className="sr-only">Beranda Tugas Duit</h1>

      <div className="region-under-brand relative z-10">
        <BalanceSummary
          balance={balance}
          onWithdraw={() => setWithdrawOpen(true)}
          onHistory={onOpenHistory}
        />
      </div>

      <div className={`animate-view-in region-gap-t ${ENTER_STEP_CLASS[1]}`}>
        <ActiveTask
          task={task}
          energy={energy}
          energyMax={energyMax}
          energySecondsToNext={energySecondsToNext}
          rewardPoolCredits={rewardPoolCredits}
          rewardPoolSecondsToNext={rewardPoolSecondsToNext}
          adsEnabled={adsEnabled}
          adViewsLeft={adViewsLeft}
          adCooldownSecondsLeft={adCooldownSecondsLeft}
          adPassReady={adPassReady}
          watchingAd={watchingAd}
          onStart={onStart}
          onStartWithAd={onStartWithAd}
        />
      </div>

      <div
        className={`animate-view-in region-t view-trim-b [--view-trim-b:var(--list-row-py)] ${ENTER_STEP_CLASS[2]}`}
      >
        <RecentTransactions history={history} completedCount={completedCount} />
      </div>

      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        balance={balance}
        withdrawals={withdrawals}
        onSubmit={onSubmitWithdrawal}
      />
    </div>
  )
}
