'use client'

import { useState, type ReactNode } from 'react'
import { WatchAdToPlay } from '@/features/ads/watch-ad-to-play'
import { DifficultyBadge } from '@/features/captcha/components/difficulty-badge'
import { EnergyRecoverySheet } from '@/features/home/energy-recovery-sheet'
import { TapAction, TapActionWaiting } from '@/shared/components/tap-action'
import { hapticTap } from '@/shell/haptic'
import type { Challenge } from '@/features/captcha/domain'
import { creditsToRupiah } from '@/domain/economy'
import { energyCostPerTask, type EnergyFill } from '@/domain/energy'
import {
  formatCountdown,
  formatCredits,
  formatLongCountdown,
  formatRupiah,
} from '@/shared/lib/format'
import { EYEBROW_CLASS } from '@/shared/components/section-label'
import { cn } from '@/shared/lib/utils'

export function ActiveTask({
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
  onOpenMissions,
  onOpenPremium,
}: {
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
  onStart: () => void
  onStartWithAd: () => void
  onOpenMissions: () => void
  onOpenPremium: (() => void) | null
}) {
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const poolEmpty = rewardPoolCredits === 0
  const energyEmpty = energy < energyCostPerTask()
  const waiting = poolEmpty || energyEmpty

  return (
    <section aria-label="Task yang tersedia">
      <div className="task-card">
        <TaskHeading title={task.title} difficulty={task.difficulty} />
        <TaskStats
          maxReward={task.maxReward}
          energy={energy}
          energyMax={energyMax}
          energyEmpty={energyEmpty}
          energyFill={energyFill}
        />
        <div className="cta-gap flex items-stretch gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <StartAction
            waiting={waiting}
            poolEmpty={poolEmpty}
            energy={energy}
            energyMax={energyMax}
            energyFill={energyFill}
            rewardPoolSecondsToNext={rewardPoolSecondsToNext}
            onStart={onStart}
            onRecover={() => setRecoveryOpen(true)}
          />
          <WatchAdToPlay
            enabled={adsEnabled}
            viewsLeft={adViewsLeft}
            cooldownSecondsLeft={adCooldownSecondsLeft}
            passReady={adPassReady}
            watching={watchingAd}
            poolEmpty={poolEmpty}
            onWatch={onStartWithAd}
          />
        </div>
      </div>

      <EnergyRecoverySheet
        open={recoveryOpen}
        onOpenChange={setRecoveryOpen}
        energy={energy}
        energyMax={energyMax}
        fill={energyFill}
        adsEnabled={adsEnabled}
        adViewsLeft={adViewsLeft}
        adReady={adPassReady || adCooldownSecondsLeft === 0}
        onWatchAd={onStartWithAd}
        onOpenMissions={onOpenMissions}
        onOpenPremium={onOpenPremium}
      />
    </section>
  )
}

function TaskHeading({
  title,
  difficulty,
}: {
  title: Challenge['title']
  difficulty: Challenge['difficulty']
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="min-w-0 text-lg font-semibold tracking-tight text-balance text-foreground">
        {title}
      </h2>
      <DifficultyBadge difficulty={difficulty} />
    </div>
  )
}

function TaskStats({
  maxReward,
  energy,
  energyMax,
  energyEmpty,
  energyFill,
}: {
  maxReward: number
  energy: number
  energyMax: number
  energyEmpty: boolean
  energyFill: EnergyFill
}) {
  return (
    <dl className="block-gap-t grid grid-cols-3 gap-1.5">
      <Stat
        label="Maks"
        value={`+${formatCredits(maxReward)}`}
        note={formatRupiah(creditsToRupiah(maxReward))}
        hint="Reward tertinggi untuk task ini. Nilainya turun kalau pengerjaannya lebih lama, dan dibatasi sisa stok reward kamu."
      />
      <Stat
        label="Biaya"
        value={formatCredits(energyCostPerTask())}
        note="energi"
        hint={`Setiap task memotong ${formatCredits(energyCostPerTask())} energi.`}
      />
      <Stat
        label="Energi"
        value={
          <span className={cn(energyEmpty && 'text-primary')}>
            {formatCredits(energy)}
            <span className="text-muted-foreground/60">/{formatCredits(energyMax)}</span>
          </span>
        }
        note={
          energyFill.secondsToFull === null
            ? 'penuh'
            : `penuh dalam ${formatLongCountdown(energyFill.secondsToFull)}`
        }
        hint={`Energi tersisa ${formatCredits(energy)} dari ${formatCredits(energyMax)}. Terisi sendiri tanpa perlu membuka aplikasi.`}
      />
    </dl>
  )
}

function Stat({
  label,
  value,
  note,
  hint,
}: {
  label: string
  value: ReactNode
  note: string
  hint: string
}) {
  return (
    <div className="stat-tile" title={hint}>
      <dt className={EYEBROW_CLASS}>{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </dd>
      <dd className="text-meta font-normal tabular-nums text-muted-foreground/70">{note}</dd>
    </div>
  )
}

/**
 * Energi habis membuka jalan keluar, stok habis tetap menunggu.
 *
 * Bedanya bukan kosmetik: energi punya jalan keluar yang dimiliki user sendiri
 * (tiket iklan, misi, premium), sedangkan stok reward diisi oleh sistem dan
 * tidak ada tombol yang bisa mempercepatnya. Jadi hanya energi yang jadi tombol
 * — menawarkan aksi untuk hal yang tidak bisa dia ubah cuma memindahkan
 * kekecewaan satu ketukan lebih jauh.
 */
function StartAction({
  waiting,
  poolEmpty,
  energy,
  energyMax,
  energyFill,
  rewardPoolSecondsToNext,
  onStart,
  onRecover,
}: {
  waiting: boolean
  poolEmpty: boolean
  energy: number
  energyMax: number
  energyFill: EnergyFill
  rewardPoolSecondsToNext: number | null
  onStart: () => void
  onRecover: () => void
}) {
  if (!waiting) {
    return (
      <TapAction
        compact
        label="Mulai"
        aria-label={`Mulai task dengan memakai ${formatCredits(energyCostPerTask())} energi, sisa ${formatCredits(energy)} dari ${formatCredits(energyMax)}`}
        onClick={() => {
          hapticTap()
          onStart()
        }}
      />
    )
  }

  if (poolEmpty) {
    return (
      <TapActionWaiting
        compact
        label="Stok habis"
        meta={
          rewardPoolSecondsToNext === null ? undefined : formatCountdown(rewardPoolSecondsToNext)
        }
      />
    )
  }

  const secondsToFull = energyFill.secondsToFull

  return (
    <TapAction
      compact
      tone="neutral"
      label="Isi energi"
      meta={secondsToFull === null ? undefined : formatLongCountdown(secondsToFull)}
      aria-label={
        secondsToFull === null
          ? 'Energi habis, lihat cara lanjut tanpa menunggu'
          : `Energi habis, penuh dalam ${formatLongCountdown(secondsToFull)}. Lihat cara lanjut tanpa menunggu`
      }
      onClick={() => {
        hapticTap()
        onRecover()
      }}
    />
  )
}
