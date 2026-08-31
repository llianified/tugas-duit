'use client'

import { hapticSelect } from '@/shell/haptic'
import { cn } from '@/shared/lib/utils'

export type SegmentedTab<T extends string> = {
  value: T
  label: string
}

type SegmentedVariant = 'pill' | 'underline'
type SegmentedSize = 'md' | 'sm'

const LIST_CLASS: Record<SegmentedVariant, string> = {
  pill: 'flex gap-1 rounded-lg bg-muted p-1',
  underline: 'flex gap-5',
}

const ITEM_CLASS: Record<SegmentedVariant, string> = {
  pill: 'flex-1 rounded-md',
  underline: 'border-b-2 px-1',
}

const SIZE_CLASS: Record<SegmentedSize, Record<SegmentedVariant, string>> = {
  md: { pill: 'px-3 py-2 text-label', underline: 'pb-2.5 text-label' },
  sm: { pill: 'px-2.5 py-1 text-meta', underline: 'pb-1.5 text-meta' },
}

const ACTIVE_CLASS: Record<SegmentedVariant, string> = {
  pill: 'bg-card text-foreground shadow-sm',
  underline: 'border-primary text-foreground',
}

const INACTIVE_CLASS: Record<SegmentedVariant, string> = {
  pill: 'text-muted-foreground hover:text-foreground',
  underline: 'border-transparent text-muted-foreground hover:text-foreground',
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  variant = 'pill',
  size = 'md',
  className,
}: {
  tabs: readonly SegmentedTab<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  variant?: SegmentedVariant
  size?: SegmentedSize
  className?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(LIST_CLASS[variant], className)}>
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
              'focus-ring transition-ui font-bold tracking-tight',
              ITEM_CLASS[variant],
              SIZE_CLASS[size][variant],
              active ? ACTIVE_CLASS[variant] : INACTIVE_CLASS[variant],
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
