'use client'

import {
  DataList,
  DataListAmount,
  DataListMarker,
  DataListRow,
} from '@/shared/components/data-list'
import { GlyphCheck, GlyphCross, GlyphWallet } from '@/shared/components/glyph'
import { formatCredits, formatHistoryTime } from '@/shared/lib/format'
import {
  getPayoutChannel,
  maskAccountNumber,
  type Withdrawal,
} from '@/features/withdraw/domain'

export function WithdrawalList({ withdrawals }: { withdrawals: Withdrawal[] }) {
  return (
    <DataList label="Permintaan kamu" badge={`${withdrawals.length} permintaan`}>
      {withdrawals.map((withdrawal, index) => (
        <WithdrawalListItem
          key={withdrawal.id}
          withdrawal={withdrawal}
          showDivider={index !== withdrawals.length - 1}
        />
      ))}
    </DataList>
  )
}

function WithdrawalListItem({
  withdrawal,
  showDivider,
}: {
  withdrawal: Withdrawal
  showDivider: boolean
}) {
  const channel = getPayoutChannel(withdrawal.channelId)
  const isPaid = withdrawal.state === 'paid'
  const isRejected = withdrawal.state === 'rejected'
  const timestamp = withdrawal.paidAt ?? withdrawal.rejectedAt ?? withdrawal.requestedAt
  const statusLabel = isPaid ? 'Terkirim' : isRejected ? 'Ditolak' : 'Diproses'

  return (
    <DataListRow
      showDivider={showDivider}
      marker={
        <DataListMarker tone={isPaid ? 'success' : 'muted'}>
          {isPaid ? (
            <GlyphCheck className="size-3.5" />
          ) : isRejected ? (
            <GlyphCross className="size-3.5" />
          ) : (
            <GlyphWallet className="size-4" />
          )}
        </DataListMarker>
      }
      title={`${channel.name} · ${maskAccountNumber(withdrawal.accountNumber)}`}
      meta={`${statusLabel} · ${formatHistoryTime(timestamp)}`}
      note={
        isRejected ? (
          <>
            {withdrawal.rejectReason ?? 'Ditolak admin.'} Saldo sudah dikembalikan.
          </>
        ) : null
      }
      amount={<DataListAmount value={`−${formatCredits(withdrawal.credits)}`} tone="neutral" />}
    />
  )
}
