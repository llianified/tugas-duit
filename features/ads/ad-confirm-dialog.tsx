'use client'

import { AppDialog, AppDialogBody } from '@/shared/components/dialog'
import { adsMaxViewsPerDay } from '@/domain/ads'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphPlay } from '@/shared/components/glyph'
import { EYEBROW_CLASS } from '@/shared/components/section-label'
import { Surface } from '@/shared/components/surface'
import { energyCostPerTask } from '@/domain/energy'
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
    <AppDialog open={open} onOpenChange={onOpenChange} title="Nonton iklan">
      <AppDialogBody>
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
      </AppDialogBody>
    </AppDialog>
  )
}
