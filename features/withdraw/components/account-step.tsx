'use client'

import type { ReactNode } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { CreditAmount } from '@/shared/components/credit-amount'
import { TextInput } from '@/shared/components/input'
import { EYEBROW_CLASS } from '@/shared/components/section-label'
import { Surface } from '@/shared/components/surface'
import { creditsToRupiah } from '@/domain/economy'
import { formatCredits, formatRupiah } from '@/shared/lib/format'
import {
  sanitizeAccountNumber,
  type PayoutChannel,
  type WithdrawalDraft,
  type WithdrawalDraftErrors,
} from '@/features/withdraw/domain'
import { cn } from '@/shared/lib/utils'

export function AccountStep({
  channel,
  credits,
  draft,
  errors,
  isSubmitting,
  onChange,
  onEditAmount,
  onSubmit,
}: {
  channel: PayoutChannel
  credits: number
  draft: WithdrawalDraft
  errors: WithdrawalDraftErrors
  isSubmitting: boolean
  onChange: (patch: Partial<WithdrawalDraft>) => void
  onEditAmount: () => void
  onSubmit: () => void
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="flex flex-1 flex-col gap-5"
    >
      <AmountRecap credits={credits} channel={channel} onEdit={onEditAmount} />

      <Field
        label={channel.accountLabel}
        htmlFor="withdraw-account-number"
        error={errors.accountNumber}
      >
        <TextInput
          id="withdraw-account-number"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder={channel.accountPlaceholder}
          value={draft.accountNumber}
          invalid={Boolean(errors.accountNumber)}
          onChange={(event) => onChange({ accountNumber: sanitizeAccountNumber(event.target.value) })}
        />
      </Field>

      <Field
        label="Nama pemilik"
        htmlFor="withdraw-account-name"
        error={errors.accountName}
        hint="Harus sama dengan nama di akun tujuan."
      >
        <TextInput
          id="withdraw-account-name"
          type="text"
          autoComplete="name"
          placeholder="Nama lengkap"
          value={draft.accountName}
          invalid={Boolean(errors.accountName)}
          onChange={(event) => onChange({ accountName: event.target.value })}
        />
      </Field>

      <div className="flex-1" />

      <ActionButton type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Mengajukan…' : 'Ajukan penarikan'}
      </ActionButton>
    </form>
  )
}

function AmountRecap({
  credits,
  channel,
  onEdit,
}: {
  credits: number
  channel: PayoutChannel
  onEdit: () => void
}) {
  return (
    <Surface
      as="button"
      type="button"
      onClick={onEdit}
      aria-label={`Ubah nominal, sekarang ${formatCredits(credits)} credit`}
      className="focus-ring transition-ui flex w-full items-center gap-3 text-left hover:bg-muted"
    >
      <span className="min-w-0 flex-1">
        <CreditAmount value={formatCredits(credits)} size="xl" tone="neutral" />
        <span className="stack-gap-t block text-xs tabular-nums text-muted-foreground">
          {formatRupiah(creditsToRupiah(credits))} · ke {channel.name}
        </span>
      </span>

      <span className="shrink-0 text-xs font-semibold text-primary">Ubah</span>
    </Surface>
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error: string | null
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={cn('block', EYEBROW_CLASS)}>
        {label}
      </label>
      <div className="stack-gap-t">{children}</div>
      {error ? (
        <p role="alert" className="stack-gap-t text-xs leading-relaxed text-destructive text-pretty">
          {error}
        </p>
      ) : hint ? (
        <p className="stack-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">{hint}</p>
      ) : null}
    </div>
  )
}
