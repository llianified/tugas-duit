'use client'

import { hapticSelect } from '@/shell/haptic'
import { GlyphChevron } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

export type SegmentedTab<T extends string> = {
  value: T
  label: string
}

/**
 * `solid` — varian asli: wadah `bg-muted`, tab aktif berupa permukaan terangkat.
 * Dipakai `features/stats`, `features/history`, dan `features/leaderboard`.
 *
 * `plain` — varian gaya fomo (Langkah 6): tanpa wadah berlatar, tab tak aktif
 * hanya teks redam, tab aktif pill `bg-muted`. Tidak mengambil lebar penuh
 * supaya bisa berdampingan dengan `FilterChip` di satu baris.
 */
export type SegmentedVariant = 'solid' | 'plain'

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  variant = 'solid',
  className,
}: {
  tabs: readonly SegmentedTab<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  variant?: SegmentedVariant
  className?: string
}) {
  const plain = variant === 'plain'
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex',
        plain ? 'gap-0.5' : 'gap-1 rounded-lg bg-muted p-1',
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
              'focus-ring transition-ui text-[13px] font-bold tracking-tight',
              plain
                ? 'rounded-full px-2.5 py-1.5'
                : 'flex-1 rounded-md px-3 py-2',
              active
                ? plain
                  ? 'bg-muted text-foreground'
                  : 'bg-card text-foreground shadow-sm'
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

export type FilterChipOption<T extends string> = {
  value: T
  label: string
}

/**
 * Chip dropdown "Semua ⌄" ala fomo. Pemilihnya adalah `<select>` asli yang
 * ditumpuk transparan di atas chip: papan tombol, pembaca layar, dan pemilih
 * bawaan Telegram/OS ikut bekerja tanpa manajemen fokus manual. Overlay-nya
 * dilebihkan ke atas & bawah supaya target sentuh tetap ≥ 44 px meski chip-nya
 * sendiri hanya 2rem.
 */
export function FilterChip<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly FilterChipOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  const selected = options.find((option) => option.value === value)
  return (
    <span
      className={cn(
        'transition-ui relative inline-flex h-8 items-center gap-1 rounded-full bg-card px-3 text-[13px] font-bold tracking-tight text-foreground ring-1 ring-border ring-inset',
        // Cincin fokus dipindahkan ke chip karena `<select>`-nya transparan.
        'has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-ring',
        className,
      )}
    >
      {selected?.label ?? ''}
      <GlyphChevron direction="down" className="size-3.5 text-muted-foreground" />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => {
          hapticSelect()
          onChange(event.target.value as T)
        }}
        className="absolute inset-x-0 -inset-y-1.5 appearance-none rounded-full bg-transparent opacity-0 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  )
}
