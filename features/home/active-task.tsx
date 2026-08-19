'use client'

import type { ReactNode } from 'react'
import { WatchAdToPlay } from '@/features/ads/watch-ad-to-play'
import { DifficultyBadge } from '@/features/captcha/components/difficulty-badge'
import { GlyphBolt } from '@/shared/components/glyph'
import { TapAction, TapActionWaiting } from '@/shared/components/tap-action'
import { hapticTap } from '@/shell/haptic'
import type { Challenge } from '@/features/captcha/domain'
import { creditsToRupiah } from '@/domain/economy'
import { energyCostPerTask } from '@/domain/energy'
import { formatCountdown, formatCredits, formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export function ActiveTask({
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
}: {
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
}) {
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
          energySecondsToNext={energySecondsToNext}
        />
        <div className="cta-gap flex flex-col gap-2">
          <StartAction
            waiting={waiting}
            poolEmpty={poolEmpty}
            energySecondsToNext={energySecondsToNext}
            rewardPoolSecondsToNext={rewardPoolSecondsToNext}
            onStart={onStart}
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
  energySecondsToNext,
}: {
  maxReward: number
  energy: number
  energyMax: number
  energyEmpty: boolean
  energySecondsToNext: number | null
}) {
  return (
    <dl className="block-gap-t grid grid-cols-3 gap-1.5">
      <Stat
        label="Maks"
        value={`+${formatCredits(maxReward)}`}
        note={formatRupiah(creditsToRupiah(maxReward))}
        hint="Reward tertinggi untuk task ini. Nilainya turun kalau pengerjaannya lebih lama, dan dibatasi sisa kolam reward kamu."
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
          energy >= energyMax
            ? 'penuh'
            : energySecondsToNext === null
              ? 'energi'
              : `+1 ${formatCountdown(energySecondsToNext)}`
        }
        hint={`Energi tersisa ${formatCredits(energy)} dari ${formatCredits(energyMax)}.`}
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
      <dt className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{value}</dd>
      <dd className="text-[11px] font-normal tabular-nums text-muted-foreground/70">{note}</dd>
    </div>
  )
}

function StartAction({
  waiting,
  poolEmpty,
  energySecondsToNext,
  rewardPoolSecondsToNext,
  onStart,
}: {
  waiting: boolean
  poolEmpty: boolean
  energySecondsToNext: number | null
  rewardPoolSecondsToNext: number | null
  onStart: () => void
}) {
  if (!waiting) {
    return (
      <TapAction
        icon={<GlyphBolt className="size-4 text-primary-foreground/80" />}
        label={`Mulai — bayar ${formatCredits(energyCostPerTask())} energi`}
        aria-label="Mulai task dengan memakai energi"
        onClick={() => {
          hapticTap()
          onStart()
        }}
      />
    )
  }

  return poolEmpty ? (
    <TapActionWaiting
      label="Kolam reward kosong"
      meta={rewardPoolSecondsToNext === null ? undefined : formatCountdown(rewardPoolSecondsToNext)}
    />
  ) : (
    <TapActionWaiting
      icon={<GlyphBolt className="size-4 text-primary" />}
      label="Energi habis"
      meta={energySecondsToNext === null ? undefined : formatCountdown(energySecondsToNext)}
    />
  )
}
