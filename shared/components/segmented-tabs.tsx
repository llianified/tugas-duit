'use client'

import { Select } from '@base-ui/react/select'
import { hapticSelect } from '@/shared/lib/haptic'
import { GlyphCheck, GlyphChevron } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

export type SegmentedTab<T extends string> = {
  value: T
  label: string
}

/** Satu bentuk saja: wadah `bg-track-surface`, tab aktif berupa permukaan terangkat, tiap tab `flex-1` sehingga barisnya selebar induknya. Wadahnya sengaja lebih gelap dari bidang tab aktif — lihat `--track-surface`; dulu keduanya sama-sama #232329 dan tab aktifnya hilang. Dipakai `features/stats`, `features/history`, dan `features/leaderboard`. Dulu ada varian `plain` (pill tanpa wadah, lebar seisi teks) khusus untuk baris Papan/Aktivitas di papan peringkat. Baris itu kini `solid` seperti Riwayat, dan pill tanpa wadah tinggal jadi bahasa untuk saringan di dalam satu tampilan — peran yang sudah dipegang `FilterChip` di bawah. Menyisakan varian tanpa pemakai hanya mengundang pemakaian yang menghidupkan lagi tabrakan arti itu. */
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
      className={cn('flex gap-1 rounded-lg bg-track-surface p-1', className)}
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
              'focus-ring transition-ui flex-1 rounded-md px-3 py-2 text-[13px] font-bold tracking-tight',
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

/** Chip dropdown "Semua ⌄" ala fomo. Sebelumnya ini `<select>` asli yang ditumpuk transparan di atas chip — gratis secara aksesibilitas, tapi tampilannya diserahkan ke OS: di mobile pemilih bawaan muncul sebagai lembar dialog berisi daftar radio setinggi layar untuk dua pilihan saja. Sekarang memakai `Select` dari Base UI, pola yang sudah dipakai `ChannelSelect`, supaya yang terbuka benar-benar menu kecil menempel di chip-nya. Papan tombol dan pembaca layar tetap terlayani karena Base UI yang mengurus peran serta manajemen fokusnya. */
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
