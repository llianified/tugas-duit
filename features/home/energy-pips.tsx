'use client'

import { cn } from '@/shared/lib/utils'

export function EnergyPips({
  energy,
  max,
  active = true,
  className,
}: {
  energy: number
  max: number
  active?: boolean
  className?: string
}) {
  const clamped = Math.max(0, Math.min(max, energy))
  const filled = active ? clamped : 0

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={`Energi ${clamped} dari ${max}`}
      className={cn('flex items-center gap-1', className)}
    >
      {Array.from({ length: max }, (_, index) => (
        <div
          key={index}
          className={cn(
            'meter-h flex-1 rounded-full transition-colors duration-300 ease-out motion-reduce:transition-none',
            index < filled ? 'bg-primary' : 'bg-border',
          )}
        />
      ))}
    </div>
  )
}
