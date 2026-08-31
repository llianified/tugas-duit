'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { stepVariants } from '@/shared/lib/motion'
import { AccountStep } from '@/features/withdraw/components/account-step'
import { AmountStep } from '@/features/withdraw/components/amount-step'
import { ConfirmStep } from '@/features/withdraw/components/confirm-step'
import {
  DEFAULT_PAYOUT_CHANNEL_ID,
  getPayoutChannel,
  isDraftValid,
  parseCreditInput,
  validateWithdrawalDraft,
  type Withdrawal,
  type WithdrawalDraft,
  type WithdrawalDraftErrors,
} from '@/features/withdraw/domain'

export type WithdrawStep = 'amount' | 'account' | 'confirm'

export interface WithdrawalSubmitInput {
  channelId: string
  accountNumber: string
  accountName: string
  credits: number
}

const NO_DRAFT_ERRORS: WithdrawalDraftErrors = {
  accountNumber: null,
  accountName: null,
  amount: null,
}

export function WithdrawForm({
  balance,
  cooldownDays,
  step,
  onStepChange,
  onSubmit,
}: {
  balance: number
  cooldownDays: number | null
  step: WithdrawStep
  onStepChange: (step: WithdrawStep) => void
  onSubmit: (input: WithdrawalSubmitInput) => Promise<Withdrawal | null>
}) {
  const [draft, setDraft] = useState<WithdrawalDraft>({
    channelId: DEFAULT_PAYOUT_CHANNEL_ID,
    accountNumber: '',
    accountName: '',
    amount: '',
  })
  const [amountSubmitted, setAmountSubmitted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const channel = getPayoutChannel(draft.channelId)
  const errors = useMemo(() => validateWithdrawalDraft(draft, balance), [draft, balance])
  const credits = parseCreditInput(draft.amount)

  function update(patch: Partial<WithdrawalDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleContinue() {
    setAmountSubmitted(true)
    if (errors.amount) return
    onStepChange('account')
  }

  function handleSubmit() {
    if (submittingRef.current) return
    setSubmitted(true)

    if (errors.amount) {
      setAmountSubmitted(true)
      onStepChange('amount')
      return
    }

    if (!isDraftValid(errors)) return

    onStepChange('confirm')
  }

  async function handleConfirm() {
    if (submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    await onSubmit({
      channelId: draft.channelId,
      accountNumber: draft.accountNumber,
      accountName: draft.accountName,
      credits,
    })
    submittingRef.current = false
    setIsSubmitting(false)
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        variants={stepVariants(step === 'amount' ? -1 : 1)}
        initial="hidden"
        animate="show"
        exit="exit"
        className="flex min-h-0 flex-1 flex-col"
      >
        {step === 'amount' ? (
          <AmountStep
            balance={balance}
            channel={channel}
            amount={draft.amount}
            credits={credits}
            error={amountSubmitted ? errors.amount : null}
            onAmountChange={(amount) => update({ amount })}
            onChannelChange={(channelId) => update({ channelId })}
            onContinue={handleContinue}
          />
        ) : step === 'account' ? (
          <AccountStep
            channel={channel}
            credits={credits}
            draft={draft}
            errors={submitted ? errors : NO_DRAFT_ERRORS}
            isSubmitting={isSubmitting}
            onChange={update}
            onEditAmount={() => onStepChange('amount')}
            onSubmit={handleSubmit}
          />
        ) : (
          <ConfirmStep
            input={{
              channelId: draft.channelId,
              accountNumber: draft.accountNumber,
              accountName: draft.accountName,
              credits,
            }}
            cooldownDays={cooldownDays}
            isSubmitting={isSubmitting}
            onConfirm={handleConfirm}
            onBack={() => onStepChange('account')}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
