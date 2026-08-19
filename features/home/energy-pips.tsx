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
            'h-1.5 flex-1 origin-center rounded-full transition-[background-color,transform,opacity] duration-300 ease-out motion-reduce:transition-none',
            index < filled ? 'scale-y-100 bg-primary opacity-100' : 'scale-y-[0.7] bg-border opacity-85',
          )}
        />
      ))}
    </div>
  )
}
