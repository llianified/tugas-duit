'use client'

import { Dialog } from '@base-ui/react/dialog'
import { creditsToRupiah } from '@/domain/economy'
import { getPayoutChannel, maskAccountNumber } from '@/features/withdraw/domain'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphCross } from '@/shared/components/glyph'
import { Surface } from '@/shared/components/surface'
import { formatCredits, formatRupiah } from '@/shared/lib/format'
import type { WithdrawalSubmitInput } from './withdraw-form'

export function WithdrawConfirmDialog({
  open,
  onOpenChange,
  input,
  isSubmitting,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  input: WithdrawalSubmitInput | null
  isSubmitting: boolean
  onConfirm: () => void
}) {
  if (!input) return null
  const channel = getPayoutChannel(input.channelId)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-50 bg-scrim duration-150" />
        <Dialog.Popup className="animate-in fade-in zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out data-[ending-style]:zoom-out-95 fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card outline-none duration-150">
          <div className="flex items-center justify-between gap-3 px-content pt-[var(--header-gap)]">
            <Dialog.Title className="text-sm font-semibold tracking-tight">Yakin tarik dana?</Dialog.Title>
            <Dialog.Close
              aria-label="Tutup konfirmasi"
              className="focus-ring transition-ui relative -mr-2 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <GlyphCross className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-3 flex flex-col gap-4 px-content pb-[var(--content-px)]">
            <Surface as="section" aria-label="Ringkasan penarikan">
              <p className="text-base font-semibold tabular-nums text-foreground">
                {formatCredits(input.credits)} credit
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {formatRupiah(creditsToRupiah(input.credits))} · {channel.name} ·{' '}
                {maskAccountNumber(input.accountNumber)}
              </p>
            </Surface>

            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              Sekali diajukan, penarikan berikutnya baru kebuka 7 hari lagi. Cooldown-nya tetap
              jalan walau pengajuan ini nanti ditolak.
            </p>

            <div className="flex flex-col gap-1">
              <ActionButton onClick={onConfirm} disabled={isSubmitting}>
                {isSubmitting ? 'Mengajukan…' : 'Ya, ajukan penarikan'}
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Periksa lagi
              </ActionButton>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
