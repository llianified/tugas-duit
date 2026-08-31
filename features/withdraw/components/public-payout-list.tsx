'use client'

import { useEffect, useState } from 'react'
import { DataList, DataListRow } from '@/shared/components/data-list'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphWallet } from '@/shared/components/glyph'
import { PageRegion } from '@/shared/components/page-region'
import { getPayoutChannel, type PublicPayout } from '@/features/withdraw/domain'
import { fetchPublicPayouts } from '@/shell/session-api'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'

function PayoutAmount({ amountIdr, credits }: { amountIdr: number; credits: number }) {
  return (
    <span className="text-sm font-semibold tabular-nums text-primary">
      {formatRupiah(amountIdr)}{' '}
      <span className="text-xs font-medium text-muted-foreground">
        {formatCredits(credits)} credit
      </span>
    </span>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; payouts: PublicPayout[] }
  | { status: 'failed' }

export function PublicPayoutPanel() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    fetchPublicPayouts()
      .then((data) => {
        if (alive) setState({ status: 'ready', payouts: data.payouts })
      })
      .catch(() => {
        if (alive) setState({ status: 'failed' })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <PageRegion>
        <p className="text-sm text-muted-foreground">Memuat bukti pembayaran…</p>
      </PageRegion>
    )
  }

  if (state.status === 'failed') {
    return (
      <EmptyState
        icon={<GlyphWallet className="glyph-md text-muted-foreground" />}
        title="Bukti belum bisa dimuat"
        description="Koneksinya lagi bermasalah. Buka lagi sebentar lagi ya."
      />
    )
  }

  if (state.payouts.length === 0) {
    return (
      <EmptyState
        icon={<GlyphWallet className="glyph-md text-muted-foreground" />}
        title="Belum ada pembayaran"
        description="Begitu penarikan pertama dibayar, buktinya tampil di sini buat semua orang."
      />
    )
  }

  return (
    <>
      <PageRegion>
        <DataList
          label="Sudah dibayar"
          badge={`${formatCredits(state.payouts.length)} terakhir`}
          ariaLabel="Bukti pembayaran ke pengguna"
        >
          {state.payouts.map((payout, index) => (
            <DataListRow
              key={`${payout.paidAt}-${index}`}
              title={payout.recipient}
              meta={`${getPayoutChannel(payout.channelId).name} · ${formatHistoryTime(payout.paidAt)}`}
              amount={<PayoutAmount amountIdr={payout.amountIdr} credits={payout.credits} />}
              showDivider={index !== state.payouts.length - 1}
            />
          ))}
        </DataList>
      </PageRegion>

      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
    </>
  )
}
