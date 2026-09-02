'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib/utils'

/** Pip energi dengan pip berikutnya terisi sebagian. Tanpa `fraction` meter ini diam belasan menit lalu melompat satu pip, dan diam yang lama itulah yang membuat user menyimpulkan aplikasinya menghukum dia. Dengan pip parsial yang naik tiap detik, jeda yang sama terbaca sebagai sesuatu yang sedang berjalan. */
export function EnergyPips({
  energy,
  max,
  fraction = 0,
  accentSweep = false,
  className,
}: {
  energy: number
  max: number
  fraction?: number
  accentSweep?: boolean
  className?: string
}) {
  const clamped = Math.max(0, Math.min(max, energy))
  const filled = clamped
  const partial = Math.max(0, Math.min(1, fraction))

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={`Energi ${clamped} dari ${max}`}
      className={cn('flex items-center gap-1', className)}
    >
      {Array.from({ length: max }, (_, index) => {
        const isFilled = index < filled
        const isFilling = !isFilled && index === filled && partial > 0

        return (
          <div key={index} className="meter-h flex-1 overflow-hidden rounded-full bg-border">
            {isFilled || isFilling ? (
              <div
                className={cn(
                  'h-full rounded-full',
                  isFilled
                    ? 'bg-primary transition-colors duration-300 ease-out motion-reduce:transition-none'
                    : 'bg-primary/45 transition-[width] duration-1000 ease-linear motion-reduce:transition-none',
                  accentSweep && 'accent-progress-sweep',
                )}
                style={{ width: isFilled ? '100%' : `${(partial * 100).toFixed(1)}%` }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
