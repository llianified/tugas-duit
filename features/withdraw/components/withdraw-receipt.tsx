'use client'

import { useEffect } from 'react'
import { hapticConfirm } from '@/shell/haptic'
import { GlyphCheck } from '@/shared/components/glyph'
import { ResultPanel } from '@/shared/components/result-panel'
import { Surface } from '@/shared/components/surface'
import { KIND_LABEL } from '@/features/withdraw/components/channel-picker'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import {
  getPayoutChannel,
  maskAccountNumber,
  type Withdrawal,
} from '@/features/withdraw/domain'

export function WithdrawReceipt({ withdrawal }: { withdrawal: Withdrawal }) {
  const channel = getPayoutChannel(withdrawal.channelId)

  useEffect(() => {
    hapticConfirm()
  }, [])

  return (
    <section
      aria-label="Permintaan tarik dana terkirim"
      className="animate-pop-in region-under-brand flex flex-1 flex-col"
    >
      <ResultPanel
        icon={<GlyphCheck className="size-6 text-success" animated />}
        title="Udah terkirim"
        credits={formatCredits(withdrawal.credits)}
        childrenAfterAmount
        tone="neutral"
        rupiah={formatRupiah(withdrawal.amountIdr)}
      >

        <Surface as="dl" className="block-gap-t w-full text-left">
          <ReceiptRow label="Tujuan" value={`${channel.name} · ${KIND_LABEL[channel.kind]}`} />
          <ReceiptRow label="Nomor" value={maskAccountNumber(withdrawal.accountNumber)} />
          <ReceiptRow label="Nama" value={withdrawal.accountName} />
          <ReceiptRow label="Waktu" value={formatHistoryTime(withdrawal.requestedAt)} />
        </Surface>
      </ResultPanel>
    </section>
  )
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-xs font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
