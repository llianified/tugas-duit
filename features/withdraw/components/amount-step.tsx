'use client'

import { useMemo } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { KEYPAD_HEIGHT_CLASS } from '@/shared/components/keypad-frame'
import { NumericKeypad } from '@/shared/components/numeric-keypad'
import { TokenMark } from '@/shared/components/token-mark'
import { ChannelSelect } from '@/features/withdraw/components/channel-picker'
import { creditsToRupiah } from '@/domain/economy/economy'
import { formatCredits, formatRupiah } from '@/shared/lib/format'
import {
  appendAmountDigit,
  dropAmountDigit,
  getAmountPresets,
  type PayoutChannel,
} from '@/domain/economy/withdrawal'
import { cn } from '@/shared/lib/utils'

export function AmountStep({
  balance,
  channel,
  amount,
  credits,
  onAmountChange,
  onChannelChange,
  onContinue,
}: {
  balance: number
  channel: PayoutChannel
  amount: string
  credits: number
  onAmountChange: (amount: string) => void
  onChannelChange: (channelId: string) => void
  onContinue: () => void
}) {
  const presets = useMemo(() => getAmountPresets(balance), [balance])

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 py-6">
        <AmountDisplay value={amount} credits={credits} />

        {presets.length > 1 ? (
          <AmountPresets presets={presets} value={credits} onSelect={onAmountChange} />
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <ChannelSelect value={channel.id} onChange={onChannelChange} />

        <ActionButton onClick={onContinue}>Lanjut</ActionButton>
      </div>

      <NumericKeypad
        ariaLabel="Papan angka jumlah"
        heightClass={KEYPAD_HEIGHT_CLASS}
        empty={amount === ''}
        onDigit={(digit) => onAmountChange(appendAmountDigit(amount, digit))}
        onBackspace={() => onAmountChange(dropAmountDigit(amount))}
      />
    </div>
  )
}

function AmountDisplay({ value, credits }: { value: string; credits: number }) {
  const empty = value === ''

  return (
    <div className="text-center">
      <p aria-live="polite" className="sr-only">
        {formatCredits(credits)} TD, {formatRupiah(creditsToRupiah(credits))}
      </p>

      <p
        aria-hidden="true"
        className="flex items-baseline justify-center gap-2 text-5xl font-semibold leading-none tracking-[-0.02em] tabular-nums"
      >
        <TokenMark className={empty ? 'text-muted-foreground/40' : 'text-foreground'} />
        <span className={empty ? 'text-muted-foreground/40' : 'text-foreground'}>
          {empty ? '0' : formatCredits(credits)}
        </span>
        <span className="animate-caret-blink h-9 w-0.5 shrink-0 self-center rounded-full bg-primary" />
        <span className="text-sm font-medium text-muted-foreground">TD</span>
      </p>

      <p
        aria-hidden="true"
        className="stack-gap-t text-sm leading-none tabular-nums text-muted-foreground"
      >
        {formatRupiah(creditsToRupiah(credits))}
      </p>
    </div>
  )
}

function AmountPresets({
  presets,
  value,
  onSelect,
}: {
  presets: number[]
  value: number
  onSelect: (amount: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Pilihan jumlah cepat" className="flex flex-wrap justify-center gap-2">
      {presets.map((credits) => {
        const selected = credits === value

        return (
          <button
            key={credits}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(String(credits))}
            className={cn(
              /* Dulu label 12px di dalam kotak setinggi 3.25rem — huruf terkecil di app justru di tombol yang paling besar. Sekarang kebalikannya: labelnya ikut `--btn-label` seperti tombol lain, dan derajatnya yang lebih rendah dari "Lanjut" dinyatakan lewat kotak yang memang lebih pendek. */
              'focus-ring focus-ring-strong transition-ui btn-label control-h-sm rounded-full px-3.5 font-semibold tabular-nums',
              selected
                ? 'bg-primary/15 text-primary'
                : 'btn-glass-quiet text-foreground hover:bg-muted-foreground/15',
            )}
          >
            {formatCredits(credits)} TD
          </button>
        )
      })}
    </div>
  )
}
