'use client'

import { cn } from '@/shared/lib/utils'

const STREAK_STEPS = [
  { minDays: 1, label: 'Baru mulai', fill: 'bg-gauge-1' },
  { minDays: 3, label: 'Tumbuh', fill: 'bg-gauge-2' },
  { minDays: 7, label: 'Kuat', fill: 'bg-gauge-3' },
  { minDays: 14, label: 'Sangat kuat', fill: 'bg-gauge-4' },
  { minDays: 30, label: 'Terkuat', fill: 'bg-gauge-5' },
] as const

function getStreakLevel(streak: number) {
  let level = 0
  for (const step of STREAK_STEPS) {
    if (streak >= step.minDays) level += 1
  }
  return level
}

export function StreakGauge({
  streak,
  atRisk,
  active = true,
  className,
}: {
  streak: number
  atRisk: boolean
  active?: boolean
  className?: string
}) {
  const level = getStreakLevel(streak)
  const step = STREAK_STEPS[Math.max(0, level - 1)]
  const filled = active ? level : 0
  const strength = atRisk ? 'Belum aman hari ini' : step.label

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={STREAK_STEPS.length}
      aria-valuenow={level}
      aria-valuetext={`Kekuatan streak ${level} dari ${STREAK_STEPS.length}: ${strength}`}
      className={cn('flex items-center gap-1', className)}
    >
      {STREAK_STEPS.map((segment, index) => (
        <div
          key={segment.minDays}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors duration-500 ease-out motion-reduce:transition-none',
            index < filled ? (atRisk ? 'bg-gauge-1' : step.fill) : 'bg-border',
          )}
        />
      ))}
    </div>
  )
}
