'use client'
import { SheetIcon } from '@/shared/components/sheet-icon'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { GlyphCross, GlyphWithdraw } from '@/shared/components/glyph'
import { AvailableBalance } from '@/features/withdraw/components/available-balance'
import { NotEligibleNote } from '@/features/withdraw/components/not-eligible-note'
import {
  WithdrawForm,
  type WithdrawalSubmitInput,
  type WithdrawStep,
} from '@/features/withdraw/components/withdraw-form'
import { WithdrawReceipt } from '@/features/withdraw/components/withdraw-receipt'
import { WithdrawalList } from '@/features/withdraw/components/withdrawal-list'
import { withdrawalGatingReason } from '@/domain/economy/withdrawal'
import {
  withdrawalRequirements,
  type Withdrawal,
  type WithdrawalEligibility,
} from '@/domain/economy/withdrawal'

export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
  withdrawals,
  eligibility,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: number
  withdrawals: Withdrawal[]
  eligibility: WithdrawalEligibility | null
  onSubmit: (input: WithdrawalSubmitInput) => Promise<Withdrawal | null>
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-40 bg-scrim duration-150" />

        <Dialog.Popup className="sheet-popup">
          <WithdrawDialogBody
            balance={balance}
            withdrawals={withdrawals}
            eligibility={eligibility}
            onSubmit={onSubmit}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function WithdrawDialogBody({
  balance,
  withdrawals,
  eligibility,
  onSubmit,
}: {
  balance: number
  withdrawals: Withdrawal[]
  eligibility: WithdrawalEligibility | null
  onSubmit: (input: WithdrawalSubmitInput) => Promise<Withdrawal | null>
}) {
  const [receipt, setReceipt] = useState<Withdrawal | null>(null)
  const [step, setStep] = useState<WithdrawStep>('amount')
  const gatingReason = withdrawalGatingReason({
    balance,
    /** Sumbernya daftar yang sama dengan yang dirender di bawah, dan keduanya datang dari satu jawaban `/api/withdrawals` — jadi gerbang dan daftarnya tidak bisa berselisih. `getPayouts` mengurutkan dari yang terbaru, dan `withdrawals_one_active_per_user` memastikan paling banyak ada satu yang `processing`, jadi ia selalu masuk halaman pertama. */
    hasProcessingWithdrawal: withdrawals.some((item) => item.state === 'processing'),
    eligibility,
  })

  async function handleSubmit(input: WithdrawalSubmitInput) {
    const created = await onSubmit(input)
    if (created) setReceipt(created)
    return created
  }

  const description = receipt
    ? 'Permintaan sudah masuk'
    : gatingReason
      ? 'Cek status dan syarat'
      : step === 'amount'
        ? 'Pilih nominal dan tujuan'
        : step === 'account'
          ? 'Isi akun penerima'
          : 'Cek sebelum ditarik'

  return (
    <>
      <div className="sheet-grip" aria-hidden="true" />

      <div className="flex shrink-0 items-center gap-2 px-content pt-3">
        <SheetIcon>
          <GlyphWithdraw className="size-4" />
        </SheetIcon>
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate text-sm font-semibold tracking-tight text-foreground">
            {receipt ? 'Penarikan diajukan' : 'Tarik dana'}
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 truncate text-[11px] leading-none text-muted-foreground">
            {description}
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Tutup"
          className="focus-ring transition-ui relative -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
        >
          <GlyphCross className="size-4" />
        </Dialog.Close>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-content pb-[calc(var(--content-px)+max(0px,env(safe-area-inset-bottom)))]">
        {receipt ? (
          <WithdrawReceipt withdrawal={receipt} />
        ) : (
          <>
            {!gatingReason ? (
              <WithdrawForm
                balance={balance}
                cooldownDays={eligibility?.cooldownDays ?? null}
                cooldownWaived={eligibility?.cooldownWaived ?? false}
                step={step}
                onStepChange={setStep}
                onSubmit={handleSubmit}
              />
            ) : (
              <>
                <AvailableBalance balance={balance} />

                <div className="mt-[var(--region-gap)]">
                  <NotEligibleNote
                    reason={gatingReason}
                    requirements={withdrawalRequirements({ balance, eligibility })}
                    cooldownEndsAt={eligibility?.cooldownEndsAt}
                    cooldownDays={eligibility?.cooldownDays ?? null}
                  />
                </div>

                {withdrawals.length > 0 ? (
                  <div className="mt-[var(--region-gap)]">
                    <WithdrawalList withdrawals={withdrawals} />
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
