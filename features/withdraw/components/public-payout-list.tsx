'use client'

import useSWR from 'swr'
import {
  DataList,
  DataListAmount,
  DataListMarker,
  DataListRow,
} from '@/shared/components/data-list'
import { GlyphCheck } from '@/shared/components/glyph'
import { getPayoutChannel, type PublicPayout } from '@/features/withdraw/domain'
import { fetchJson } from '@/shell/api-client'
import { formatHistoryTime, formatRupiah } from '@/shared/lib/format'

interface PublicPayoutsResponse {
  payouts: PublicPayout[]
}

export function PublicPayoutList() {
  const { data } = useSWR<PublicPayoutsResponse>('/api/public-payouts', fetchJson, {
    revalidateOnFocus: false,
  })
  const payouts = data?.payouts ?? []
  if (payouts.length === 0) return null

  return (
    <div className="mt-[var(--region-gap)]">
      <DataList label="Baru aja cair" badge={`${payouts.length} penarikan`}>
        {payouts.map((payout, index) => (
          <PublicPayoutItem
            key={`${payout.paidAt}-${index}`}
            payout={payout}
            showDivider={index !== payouts.length - 1}
          />
        ))}
      </DataList>
    </div>
  )
}

function PublicPayoutItem({
  payout,
  showDivider,
}: {
  payout: PublicPayout
  showDivider: boolean
}) {
  return (
    <DataListRow
      showDivider={showDivider}
      marker={
        <DataListMarker tone="success">
          <GlyphCheck className="size-3.5" />
        </DataListMarker>
      }
      title={`${payout.recipient} · ${getPayoutChannel(payout.channelId).name}`}
      meta={`Terkirim · ${formatHistoryTime(payout.paidAt)}`}
      amount={<DataListAmount value={formatRupiah(payout.amountIdr)} tone="primary" />}
    />
  )
}
