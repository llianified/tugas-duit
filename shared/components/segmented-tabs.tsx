'use client'

import { Select } from '@base-ui/react/select'
import { hapticSelect } from '@/shell/haptic'
import { GlyphCheck, GlyphChevron } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

export type SegmentedTab<T extends string> = {
  value: T
  label: string
}

/**
 * `solid` — varian asli: wadah `bg-track-surface`, tab aktif berupa permukaan
 * terangkat. Wadahnya sengaja lebih gelap dari bidang tab aktif — lihat
 * `--track-surface`; dulu keduanya sama-sama #232329 dan tab aktifnya hilang.
 * Dipakai `features/stats`, `features/history`, dan `features/leaderboard`.
 *
 * `pill` — track bulat rapat: wadah `bg-muted` dengan pill aktif `bg-card`.
 * Bentuk yang sama dipakai pemilih rentang di `features/profile` lewat
 * `SEGMENTED_PILL_TRACK_CLASS` / `segmentedPillItemClass` di bawah — sengaja
 * satu sumber, karena keduanya kontrol pemilih sebaris yang berdampingan
 * dengan elemen lain (label sesi di profil, `FilterChip` di papan) dan dulu
 * tampil berbeda padahal perannya sama. Tidak mengambil lebar penuh.
 */
export type SegmentedVariant = 'solid' | 'pill'

/**
 * Wadah pill. `shrink-0` supaya track tidak dipadatkan saat berbagi baris
 * dengan teks yang bisa memanjang.
 */
export const SEGMENTED_PILL_TRACK_CLASS = 'flex shrink-0 gap-1 rounded-full bg-muted p-1'

export function segmentedPillItemClass(active: boolean) {
  return cn(
    'focus-ring transition-ui rounded-full px-2.5 py-1 text-[13px] font-bold tracking-tight',
    active ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground',
  )
}

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
  const pill = variant === 'pill'
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        pill ? SEGMENTED_PILL_TRACK_CLASS : 'flex gap-1 rounded-lg bg-track-surface p-1',
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
                ? 'btn-glass-quiet text-foreground'
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
 * Chip dropdown "Semua ⌄" ala fomo. Sebelumnya ini `<select>` asli yang ditumpuk
 * transparan di atas chip — gratis secara aksesibilitas, tapi tampilannya diserahkan
 * ke OS: di mobile pemilih bawaan muncul sebagai lembar dialog berisi daftar radio
 * setinggi layar untuk dua pilihan saja. Sekarang memakai `Select` dari Base UI,
 * pola yang sudah dipakai `ChannelSelect`, supaya yang terbuka benar-benar menu
 * kecil menempel di chip-nya. Papan tombol dan pembaca layar tetap terlayani
 * karena Base UI yang mengurus peran serta manajemen fokusnya.
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
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (typeof next !== 'string' || next === value) return
        hapticSelect()
        onChange(next as T)
      }}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          'focus-ring transition-ui group/trigger inline-flex h-8 items-center gap-1 rounded-full bg-card px-3 text-[13px] font-bold tracking-tight text-foreground ring-1 ring-border ring-inset',
          className,
        )}
      >
        {selected?.label ?? ''}
        <Select.Icon className="flex shrink-0 text-muted-foreground">
          <GlyphChevron
            direction="down"
            className="size-3.5 transition-transform duration-150 ease-out group-data-[popup-open]/trigger:rotate-180 motion-reduce:transition-none"
          />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          alignItemWithTrigger={false}
          className="z-50 outline-none"
        >
          <Select.Popup className="min-w-[var(--anchor-width)] rounded-lg border border-border bg-card p-1 outline-none">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'focus-ring transition-ui flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-bold tracking-tight',
                  'data-[highlighted]:bg-muted data-[selected]:text-primary',
                )}
              >
                <Select.ItemText className="min-w-0 flex-1 truncate">{option.label}</Select.ItemText>
                <Select.ItemIndicator className="flex shrink-0">
                  <GlyphCheck className="size-3.5 text-primary" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
