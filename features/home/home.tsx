'use client'

import { useState } from 'react'
import { ActiveTask } from '@/features/home/active-task'
import { BalanceSummary } from '@/features/home/balance-summary'
import { RecentTransactions } from '@/features/home/recent-transactions'
import { ChannelBonusCard } from '@/features/channel/channel-card'
import { channelBonusReachable } from '@/features/channel/use-channel-bonus'
import { PremiumCard } from '@/features/premium/components/premium-card'
import { PremiumDialog } from '@/features/premium/components/premium-dialog'
import { CardCarousel } from '@/shared/components/card-carousel'
import type { Challenge, HistoryEntry } from '@/domain/task/challenge'
import type { EnergyFill } from '@/domain/economy/energy'
import type { ChannelBonusState, PremiumState } from '@/shell/session-api'
import { cn } from '@/shared/lib/utils'
import { WithdrawDialog } from '@/features/withdraw/components/withdraw-dialog'
import type { WithdrawalSubmitInput } from '@/features/withdraw/components/withdraw-form'
import type { Withdrawal, WithdrawalEligibility } from '@/domain/economy/withdrawal'

interface HomeViewProps {
  balance: number
  taskBalance: number
  referralCredits: number
  withdrawnCredits: number
  history: HistoryEntry[]
  task: Challenge
  energy: number
  energyMax: number
  energyFill: EnergyFill
  rewardPoolCredits: number | null
  rewardPoolSecondsToNext: number | null
  adsEnabled: boolean
  adViewsLeft: number
  adCooldownSecondsLeft: number
  adPassReady: boolean
  watchingAd: boolean
  /** Lihat `ActiveTask`: `hold` menahan perpindahan halaman selama karcisnya disobek. */
  onStart: (hold?: Promise<unknown>) => Promise<boolean>
  onStartWithAd: () => void
  withdrawals: Withdrawal[]
  withdrawalEligibility: WithdrawalEligibility | null
  onSubmitWithdrawal: (input: WithdrawalSubmitInput) => Promise<Withdrawal | null>
  onOpenHistory: () => void
  onOpenMissions: () => void
  premium: PremiumState | null
  channelBonus: ChannelBonusState | null
  onRefreshSession: () => Promise<unknown>
}

const ENTER_STEP_CLASS = ['enter-step-0', 'enter-step-1', 'enter-step-2'] as const

export function HomeView({
  balance,
  history,
  task,
  energy,
  energyMax,
  energyFill,
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
  onOpenMissions,
  premium,
  channelBonus,
  onRefreshSession,
}: HomeViewProps) {
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [premiumOpen, setPremiumOpen] = useState(false)

  /** Tab beranda dilepas begitu Misi pindah ke nav. Tiga tab menyisakan dua tanpa Misi, dan dua-duanya sudah bermasalah sebelum itu: "Aktivitas" dan view "Riwayat" adalah data yang sama dengan dua nama berbeda — user tidak punya cara menduga bedanya — sementara "Bonus" cuma ada selama bonusnya belum diklaim, jadi jumlah tabnya berubah di tempat yang sama. Sisanya sekarang berderet, dan barisnya memakai nama aslinya, "Transaksi terakhir", sehingga tidak lagi bersaing dengan Riwayat. Bonus diletakkan di atas transaksi karena ia satu-satunya yang menuntut aksi dan bisa hilang; transaksi hanya catatan yang tidak ke mana-mana. */
  const premiumReachable = Boolean(premium && (premium.active || premium.paymentEnabled))
  const bonusReachable = channelBonusReachable(channelBonus)

  /** Dua perangko berbagi SATU tempat dan bergantian tiap lima detik. Sebelumnya keduanya berdiri bertumpuk, dan itu memberi beranda dua ajakan sederajat yang saling menekan tepat sebelum daftar transaksi — yang di bawah hampir selalu terlewat. Daftarnya disaring di sini, bukan di dalam carousel: kartu yang tidak tersedia TIDAK BOLEH masuk sebagai `null`, karena `null` tetap terhitung satu slide dan carousel-nya akan berputar ke halaman kosong. Konsekuensinya juga yang diinginkan — kalau tinggal satu yang tersedia (bonus sudah diklaim, atau pembayaran premium dimatikan), `CardCarousel` mengembalikannya sebagai kartu tunggal tanpa trek dan tanpa titik. Kalau tidak ada satu pun, tidak ada apa-apa, dan `region-gap-t` di atas daftar transaksi ikut hilang bersamanya. */
  const stamps = [
    premium && premiumReachable
      ? {
          key: 'premium',
          label: 'Lihat kartu premium',
          node: <PremiumCard premium={premium} onOpen={() => setPremiumOpen(true)} />,
        }
      : null,
    bonusReachable
      ? {
          key: 'channel-bonus',
          label: 'Lihat kartu bonus channel',
          node: <ChannelBonusCard bonus={channelBonus} onClaimed={onRefreshSession} />,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <div className="home-skin view-min-h flex flex-col">
      <h1 className="sr-only">Beranda Tugas Duit</h1>

      <div className="hero-band region-under-brand relative z-10">
        <BalanceSummary
          balance={balance}
          history={history}
          onWithdraw={() => setWithdrawOpen(true)}
        />

        <div className={`animate-view-in region-gap-t ${ENTER_STEP_CLASS[1]}`}>
          <ActiveTask
            task={task}
            energy={energy}
            energyMax={energyMax}
            energyFill={energyFill}
            rewardPoolCredits={rewardPoolCredits}
            rewardPoolSecondsToNext={rewardPoolSecondsToNext}
            adsEnabled={adsEnabled}
            adViewsLeft={adViewsLeft}
            adCooldownSecondsLeft={adCooldownSecondsLeft}
            adPassReady={adPassReady}
            watchingAd={watchingAd}
            onStart={onStart}
            onStartWithAd={onStartWithAd}
            onOpenMissions={onOpenMissions}
            onOpenPremium={premiumReachable ? () => setPremiumOpen(true) : null}
          />
        </div>
      </div>

      <div className={`animate-view-in region-t ${ENTER_STEP_CLASS[2]}`}>
        <CardCarousel ariaLabel="Penawaran" items={stamps} />

        <div className={cn('home-ledger', stamps.length > 0 && 'region-gap-t')}>
          <RecentTransactions history={history} onSeeAll={onOpenHistory} />
        </div>
      </div>

      <div className="flex-1" />

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
