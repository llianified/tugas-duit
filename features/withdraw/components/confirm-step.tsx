'use client'

import { creditsToRupiah } from '@/domain/economy/economy'
import { getPayoutChannel, maskAccountNumber, PAYOUT_ETA_TEXT } from '@/domain/economy/withdrawal'
import { ActionButton } from '@/shared/components/action-button'
import { Surface } from '@/shared/components/surface'
import { formatCredits, formatRupiah } from '@/shared/lib/format'
import type { WithdrawalSubmitInput } from './withdraw-form'

export function ConfirmStep({
  input,
  cooldownDays,
  isSubmitting,
  onConfirm,
  onBack,
}: {
  input: WithdrawalSubmitInput
  cooldownDays: number | null
  isSubmitting: boolean
  onConfirm: () => void
  onBack: () => void
}) {
  const channel = getPayoutChannel(input.channelId)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm font-semibold tracking-tight">Tarik saldo sekarang?</p>

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
        {PAYOUT_ETA_TEXT} Kami kabari lewat bot setelah dikirim.
      </p>

      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        {cooldownDays === null
          ? 'Penarikan berikutnya tersedia setelah cooldown selesai.'
          : `Penarikan berikutnya tersedia ${formatCredits(cooldownDays)} hari lagi.`}{' '}
        Cooldown tetap jalan meski pengajuan ditolak.
      </p>

      <div className="flex-1" />

      <div className="flex flex-col gap-1">
        <ActionButton onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Mengirim…' : 'Tarik'}
        </ActionButton>
        <ActionButton variant="ghost" onClick={onBack} disabled={isSubmitting}>
          Kembali
        </ActionButton>
      </div>
    </div>
  )
}
