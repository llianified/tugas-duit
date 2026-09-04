'use client'

import { cn } from '@/shared/lib/utils'

const STREAK_STEPS = [
  { minDays: 1, label: 'Baru mulai' },
  { minDays: 3, label: 'Tumbuh' },
  { minDays: 7, label: 'Kuat' },
  { minDays: 14, label: 'Sangat kuat' },
  { minDays: 30, label: 'Terkuat' },
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
  className,
}: {
  streak: number
  atRisk: boolean
  className?: string
}) {
  const level = getStreakLevel(streak)
  const step = STREAK_STEPS[Math.max(0, level - 1)]
  const filled = level
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
            'meter-h flex-1 rounded-full transition-colors duration-500 ease-out motion-reduce:transition-none',
            index < filled ? (atRisk ? 'bg-star' : 'bg-primary') : 'bg-border',
          )}
        />
      ))}
    </div>
  )
}
