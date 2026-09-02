'use client'

import { Dialog } from '@base-ui/react/dialog'
import { adsMaxViewsPerDay } from '@/domain/ads/ads'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphCross, GlyphPlay } from '@/shared/components/glyph'
import { EYEBROW_CLASS } from '@/shared/components/section-label'
import { Surface } from '@/shared/components/surface'
import { energyCostPerTask } from '@/domain/economy/energy'
import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export function AdConfirmDialog({
  open,
  onOpenChange,
  viewsLeft,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewsLeft: number
  onConfirm: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-40 bg-scrim duration-150" />

        <Dialog.Popup className="animate-in fade-in zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out data-[ending-style]:zoom-out-95 fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card outline-none duration-150">
          <div className="flex shrink-0 items-center justify-between gap-3 px-content pt-[var(--header-gap)]">
            <Dialog.Title className="text-sm font-semibold tracking-tight">
              Nonton iklan
            </Dialog.Title>
            <Dialog.Close
              aria-label="Tutup"
              className="focus-ring transition-ui relative -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
            >
              <GlyphCross className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-content pb-[var(--content-px)]">
            <Surface className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <GlyphPlay className="size-4 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block', EYEBROW_CLASS)}>Jatah hari ini</span>
                <span className="mt-0.5 block text-base font-semibold tabular-nums text-foreground">
                  {formatCredits(viewsLeft)}
                  <span className="text-muted-foreground/60">
                    /{formatCredits(adsMaxViewsPerDay())}
                  </span>
                </span>
              </span>
            </Surface>

            <p className="mt-[var(--region-gap)] text-sm leading-relaxed text-muted-foreground text-pretty">
              Iklan akan diputar sampai selesai. Setelah itu kamu dapat 1 tiket buat mulai task
              tanpa memotong {formatCredits(energyCostPerTask())} energi.
            </p>

            <div className="mt-[var(--region-gap)] flex flex-col gap-1">
              <ActionButton
                onClick={() => {
                  onOpenChange(false)
                  onConfirm()
                }}
              >
                Putar iklan
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => onOpenChange(false)}>
                Nanti saja
              </ActionButton>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
