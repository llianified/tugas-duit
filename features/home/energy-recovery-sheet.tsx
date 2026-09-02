'use client'

import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { EnergyPips } from '@/features/home/energy-pips'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphChevron, GlyphCross, GlyphCrown, GlyphPlay, GlyphTrophy } from '@/shared/components/glyph'
import { EYEBROW_CLASS } from '@/shared/components/section-label'
import { Surface } from '@/shared/components/surface'
import type { EnergyFill } from '@/domain/energy'
import { formatCredits, formatLongCountdown } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Layar energi habis tidak boleh jadi jalan buntu. Sebelumnya user hanya diberi tulisan "Energi habis" dan sebuah hitungan mundur — tidak ada satu pun hal yang bisa dia lakukan dari titik itu, dan di aplikasi penghasilan jalan buntu berujung uninstall. Semua jalan keluar yang sudah dimiliki aplikasi ini dikumpulkan di sini: tiket iklan, misi harian, dan premium untuk yang ingin regennya lebih cepat. */
export function EnergyRecoverySheet({
  open,
  onOpenChange,
  energy,
  energyMax,
  fill,
  adsEnabled,
  adViewsLeft,
  adReady,
  onWatchAd,
  onOpenMissions,
  onOpenPremium,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  energy: number
  energyMax: number
  fill: EnergyFill
  adsEnabled: boolean
  adViewsLeft: number
  adReady: boolean
  onWatchAd: () => void
  onOpenMissions: () => void
  onOpenPremium: (() => void) | null
}) {
  const close = () => onOpenChange(false)
  const adAvailable = adsEnabled && adViewsLeft > 0 && adReady

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-40 bg-scrim duration-150" />

        <Dialog.Popup className="animate-in fade-in zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out data-[ending-style]:zoom-out-95 fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card outline-none duration-150">
          <div className="flex shrink-0 items-center justify-between gap-3 px-content pt-[var(--header-gap)]">
            <Dialog.Title className="text-sm font-semibold tracking-tight">
              Lanjut tanpa nunggu
            </Dialog.Title>
            <Dialog.Close
              aria-label="Tutup"
              className="focus-ring transition-ui relative -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
            >
              <GlyphCross className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-content pb-[var(--content-px)]">
            <Surface>
              <div className="flex items-baseline justify-between gap-3">
                <span className={EYEBROW_CLASS}>Energi</span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {fill.secondsToFull === null
                    ? 'Penuh'
                    : `Penuh dalam ${formatLongCountdown(fill.secondsToFull)}`}
                </span>
              </div>
              <div className="mt-2">
                <EnergyPips energy={energy} max={energyMax} fraction={fill.fraction} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty">
                Energi terisi sendiri, jadi stok {formatCredits(energyMax)} kamu balik utuh tanpa
                perlu buka aplikasi. Kalau mau lanjut sekarang, ini pilihannya.
              </p>
            </Surface>

            <div className="mt-[var(--region-gap)] flex flex-col gap-1.5">
              {adAvailable ? (
                <RecoveryOption
                  icon={<GlyphPlay className="size-4 text-primary" />}
                  label="Nonton iklan"
                  note={`Dapat 1 tiket buat 1 task, sisa ${formatCredits(adViewsLeft)} kali hari ini`}
                  onClick={() => {
                    close()
                    onWatchAd()
                  }}
                />
              ) : null}

              <RecoveryOption
                icon={<GlyphTrophy className="size-4 text-primary" />}
                label="Ambil misi harian"
                note="Misi yang selesai memberi energi tambahan"
                onClick={() => {
                  close()
                  onOpenMissions()
                }}
              />

              {onOpenPremium ? (
                <RecoveryOption
                  icon={<GlyphCrown className="size-4 text-primary" />}
                  label="Premium"
                  note="Kapasitas energi lebih besar dan regen lebih cepat"
                  onClick={() => {
                    close()
                    onOpenPremium()
                  }}
                />
              ) : null}
            </div>

            <ActionButton variant="ghost" className="mt-[var(--region-gap)]" onClick={close}>
              Nanti saja
            </ActionButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function RecoveryOption({
  icon,
  label,
  note,
  onClick,
}: {
  icon: ReactNode
  label: string
  note: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'focus-ring transition-ui press-scale-soft group flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left',
        'hover:bg-foreground/[0.04] active:bg-foreground/[0.07]',
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground text-pretty">
          {note}
        </span>
      </span>
      <GlyphChevron
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none"
      />
    </button>
  )
}
