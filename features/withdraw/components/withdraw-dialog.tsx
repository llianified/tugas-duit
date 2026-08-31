'use client'

import { useState } from 'react'
import { AppDialog, AppDialogBody } from '@/shared/components/dialog'
import { AvailableBalance } from '@/features/withdraw/components/available-balance'
import {
  NotEligibleNote,
  type GatingReason,
} from '@/features/withdraw/components/not-eligible-note'
import {
  WithdrawForm,
  type WithdrawalSubmitInput,
  type WithdrawStep,
} from '@/features/withdraw/components/withdraw-form'
import { WithdrawReceipt } from '@/features/withdraw/components/withdraw-receipt'
import { WithdrawalList } from '@/features/withdraw/components/withdrawal-list'
import { getWithdrawalStatus } from '@/domain/economy'
import type { Withdrawal, WithdrawalEligibility } from '@/features/withdraw/domain'

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
    <AppDialog open={open} onOpenChange={onOpenChange} title="Tarik dana">
      <WithdrawDialogBody
        balance={balance}
        withdrawals={withdrawals}
        eligibility={eligibility}
        onSubmit={onSubmit}
      />
    </AppDialog>
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
  const status = getWithdrawalStatus(balance)
  const hasPending = withdrawals.some((item) => item.state === 'processing')
  const gatingReason: GatingReason | null = !status.eligible
    ? 'balance'
    : !eligibility
      ? 'loading'
      : eligibility.activeDays < eligibility.requiredActiveDays
        ? 'days'
        : eligibility.activeReferralCount < eligibility.requiredActiveReferrals
          ? 'referrals'
          : eligibility.cooldownEndsAt
            ? 'cooldown'
            : hasPending
              ? 'pending'
              : null

  async function handleSubmit(input: WithdrawalSubmitInput) {
    const created = await onSubmit(input)
    if (created) setReceipt(created)
    return created
  }

  return (
    <AppDialogBody>
      <>
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
                    balance={balance}
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
      </>
    </AppDialogBody>
  )
}
