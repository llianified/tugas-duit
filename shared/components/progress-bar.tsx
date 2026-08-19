'use client'

import { cn } from '@/shared/lib/utils'
import { useCssVars } from '@/shared/lib/use-css-vars'

export function ProgressBar({
  value,
  max,
  valueText,
  tone = 'primary',
  className,
}: {
  value: number
  max: number
  valueText: string
  tone?: 'primary' | 'success'
  className?: string
}) {
  const safeMax = Math.max(0, max)
  const clampedValue = Math.min(safeMax, Math.max(0, value))
  const percent = safeMax === 0 ? 0 : (clampedValue / safeMax) * 100
  const accessibleValueText = value >= max && max > 0 ? `Target tercapai: ${valueText}` : valueText
  const fillRef = useCssVars<HTMLDivElement>({ '--progress-bar-fill': `${percent}%` })

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clampedValue}
      aria-valuetext={accessibleValueText}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-border', className)}
    >
      <div
        ref={fillRef}
        className={cn(
          'h-full w-[var(--progress-bar-fill,0%)] rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
          tone === 'success' ? 'bg-success' : 'bg-primary',
        )}
      />
    </div>
  )
}

