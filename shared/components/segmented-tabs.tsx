'use client'

import { hapticSelect } from '@/shell/haptic'
import { cn } from '@/shared/lib/utils'

export type SegmentedTab<T extends string> = {
  value: T
  label: string
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: readonly SegmentedTab<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 rounded-lg bg-muted p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`tab-${tab.value}`}
            aria-selected={active}
            aria-controls={`panel-${tab.value}`}
            onClick={() => {
              if (active) return
              hapticSelect()
              onChange(tab.value)
            }}
            className={cn(
              'focus-ring transition-ui flex-1 rounded-md px-3 py-1.5 text-xs font-semibold',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
