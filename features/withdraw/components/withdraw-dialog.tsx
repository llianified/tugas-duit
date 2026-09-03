'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { GlyphCross } from '@/shared/components/glyph'
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
import type { Withdrawal, WithdrawalEligibility } from '@/domain/economy/withdrawal'

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

        <Dialog.Popup className="animate-in fade-in zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out data-[ending-style]:zoom-out-95 fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card outline-none duration-150">
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

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 px-content pt-[var(--header-gap)]">
        <Dialog.Title className="text-sm font-semibold tracking-tight">Tarik dana</Dialog.Title>
        <Dialog.Close
          aria-label="Tutup"
          className="focus-ring transition-ui relative -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
        >
          <GlyphCross className="size-4" />
        </Dialog.Close>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-content pb-[var(--content-px)]">
        {receipt ? (
          <WithdrawReceipt withdrawal={receipt} />
        ) : (
          <>
            {!gatingReason ? (
              <WithdrawForm
                balance={balance}
                cooldownDays={eligibility?.cooldownDays ?? null}
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
                    activeReferralCount={eligibility?.activeReferralCount}
                    requiredActiveReferrals={eligibility?.requiredActiveReferrals}
                    cooldownEndsAt={eligibility?.cooldownEndsAt}
                    cooldownDays={eligibility?.cooldownDays ?? null}
                    activeDays={eligibility?.activeDays}
                    requiredActiveDays={eligibility?.requiredActiveDays}
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
