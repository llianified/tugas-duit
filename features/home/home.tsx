'use client'

import { useState } from 'react'
import { ActiveTask } from '@/features/home/active-task'
import { BalanceSummary } from '@/features/home/balance-summary'
import { RecentTransactions } from '@/features/home/recent-transactions'
import { ChannelBonusCard } from '@/features/channel/channel-card'
import { MissionCard } from '@/features/missions/mission-card'
import { PremiumCard } from '@/features/premium/components/premium-card'
import { PremiumDialog } from '@/features/premium/components/premium-dialog'
import type { Challenge, HistoryEntry } from '@/features/captcha/domain'
import type { ChannelBonusState, PremiumState } from '@/shell/session-api'
import { WithdrawDialog } from '@/features/withdraw/components/withdraw-dialog'
import type { WithdrawalSubmitInput } from '@/features/withdraw/components/withdraw-form'
import type { Withdrawal, WithdrawalEligibility } from '@/features/withdraw/domain'
import { SegmentedTabs, type SegmentedTab } from '@/shared/components/segmented-tabs'

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
  withdrawalEligibility: WithdrawalEligibility | null
  onSubmitWithdrawal: (input: WithdrawalSubmitInput) => Promise<Withdrawal | null>
  onOpenHistory: () => void
  premium: PremiumState | null
  channelBonus: ChannelBonusState | null
  onRefreshSession: () => Promise<unknown>
}

const ENTER_STEP_CLASS = ['enter-step-0', 'enter-step-1', 'enter-step-2'] as const

type HomePanel = 'missions' | 'activity' | 'bonus' | 'premium'

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
  withdrawalEligibility,
  onSubmitWithdrawal,
  onOpenHistory,
  premium,
  channelBonus,
  onRefreshSession,
}: HomeViewProps) {
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [premiumOpen, setPremiumOpen] = useState(false)

  /**
   * Kartu sekunder ditumpuk di tab, bukan berderet ke bawah.
   *
   * Misi, bonus channel, dan premium sama-sama sekunder terhadap task — tidak ada yang
   * perlu terlihat bersamaan, dan menderetkan ketiganya mendorong transaksi terakhir
   * keluar layar sehingga beranda selalu menuntut gulir. Sebagai tab, tingginya tetap
   * setinggi satu kartu berapa pun yang aktif.
   *
   * Tab yang isinya tidak ada tidak dirender sama sekali: user yang sudah mengklaim
   * bonus channel tidak diberi tab kosong untuk ditekan.
   */
  const panels: SegmentedTab<HomePanel>[] = [
    { value: 'missions', label: 'Misi' },
    { value: 'activity', label: 'Aktivitas' },
  ]
  if (channelBonus?.enabled && !channelBonus.claimed) {
    panels.push({ value: 'bonus', label: 'Bonus' })
  }
  if (premium && (premium.active || premium.paymentEnabled)) {
    panels.push({ value: 'premium', label: premium.active ? 'Premium' : 'VIP' })
  }
  const [panel, setPanel] = useState<HomePanel>('missions')
  const activePanel = panels.some((item) => item.value === panel) ? panel : 'missions'

  return (
    <div className="view-min-h flex flex-col">
      <h1 className="sr-only">Beranda Tugas Duit</h1>

      <div className="hero-band region-under-brand relative z-10">
        <BalanceSummary
          balance={balance}
          onWithdraw={() => setWithdrawOpen(true)}
          onHistory={onOpenHistory}
        />

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
      </div>

      <div className={`animate-view-in region-t ${ENTER_STEP_CLASS[2]}`}>
        {panels.length > 1 ? (
          <SegmentedTabs
            tabs={panels}
            value={activePanel}
            onChange={setPanel}
            ariaLabel="Panel beranda"
          />
        ) : null}

        <div
          key={activePanel}
          role={panels.length > 1 ? 'tabpanel' : undefined}
          id={panels.length > 1 ? `panel-${activePanel}` : undefined}
          aria-labelledby={panels.length > 1 ? `tab-${activePanel}` : undefined}
          className={panels.length > 1 ? 'animate-fade-in region-gap-t' : undefined}
        >
          {activePanel === 'missions' ? (
            <MissionCard refreshKey={completedCount} onClaimed={onRefreshSession} />
          ) : null}
          {activePanel === 'activity' ? (
            <RecentTransactions history={history} completedCount={completedCount} />
          ) : null}
          {activePanel === 'bonus' && channelBonus ? (
            <ChannelBonusCard bonus={channelBonus} onClaimed={onRefreshSession} />
          ) : null}
          {activePanel === 'premium' && premium ? (
            <PremiumCard premium={premium} onOpen={() => setPremiumOpen(true)} />
          ) : null}
        </div>
      </div>

      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />

      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        balance={balance}
        withdrawals={withdrawals}
        eligibility={withdrawalEligibility}
        onSubmit={onSubmitWithdrawal}
      />

      {premium ? (
        <PremiumDialog
          open={premiumOpen}
          onOpenChange={setPremiumOpen}
          premium={premium}
          onRefresh={onRefreshSession}
        />
      ) : null}
    </div>
  )
}
