'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
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
  const [proofId, setProofId] = useState<string | null>(null)

  return (
    <>
      <DataList label="Permintaan kamu" badge={`${withdrawals.length} permintaan`}>
        {withdrawals.map((withdrawal, index) => (
          <WithdrawalListItem
            key={withdrawal.id}
            withdrawal={withdrawal}
            showDivider={index !== withdrawals.length - 1}
            onShowProof={() => setProofId(withdrawal.id)}
          />
        ))}
      </DataList>

      <ProofDialog id={proofId} onClose={() => setProofId(null)} />
    </>
  )
}

function WithdrawalListItem({
  withdrawal,
  showDivider,
  onShowProof,
}: {
  withdrawal: Withdrawal
  showDivider: boolean
  onShowProof: () => void
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
            <GlyphCheck className="glyph-sm" />
          ) : isRejected ? (
            <GlyphCross className="glyph-sm" />
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
        ) : isPaid && withdrawal.hasProof ? (
          <button
            type="button"
            onClick={onShowProof}
            className="focus-ring transition-ui rounded-md text-xs font-semibold text-primary"
          >
            Lihat bukti
          </button>
        ) : null
      }
      amount={<DataListAmount value={`−${formatCredits(withdrawal.credits)}`} tone="neutral" />}
    />
  )
}

function ProofDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Dialog.Root open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-50 bg-scrim duration-150" />
        <Dialog.Popup className="animate-in fade-in zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out data-[ending-style]:zoom-out-95 fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card outline-none duration-150">
          <div className="flex items-center justify-between gap-3 px-content pt-[var(--header-gap)]">
            <Dialog.Title className="text-sm font-semibold tracking-tight">
              Bukti transfer
            </Dialog.Title>
            <Dialog.Close
              aria-label="Tutup bukti transfer"
              className="focus-ring transition-ui relative -mr-2 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <GlyphCross className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-3 flex min-h-0 flex-col overflow-y-auto px-content pb-[var(--content-px)]">
            {id ? (
              // Bukti transfer disajikan `/api/withdrawals/[id]/proof` di balik sesi user
              // dan `Cache-Control: private, no-store`, jadi optimizer next/image tidak
              // bisa mengambilnya — fetch-nya jalan server-side tanpa cookie dan berujung
              // 401. Dimensinya juga tidak diketahui (file dari admin, rasio bebas).
              // `images.unoptimized` sudah aktif project-wide, jadi next/image cuma
              // menambah wrapper tanpa optimasi apa pun.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/withdrawals/${id}/proof`}
                alt="Bukti transfer dari admin"
                loading="lazy"
                className="w-full rounded-lg bg-muted"
              />
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
