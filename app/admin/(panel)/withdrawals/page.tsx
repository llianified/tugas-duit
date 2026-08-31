import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayoutChannel } from '@/features/withdraw/domain'
import { listPendingPayouts, PENDING_PAYOUT_PAGE_SIZE } from '@/server/payout'
import { getSessionUser } from '@/server/session'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { AutoRefresh } from '../auto-refresh'
import { CopyButton } from './copy-button'
import { PayoutActions } from './payout-actions'
import { Surface } from '@/shared/components/surface'
import { actionButtonClass } from '@/shared/components/action-button'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QUEUE_REFRESH_SECONDS = 15

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>
}) {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  const raw = Number((await searchParams).offset)
  const offset = Number.isSafeInteger(raw) && raw > 0 ? raw : 0
  const { payouts: pending, hasMore } = await listPendingPayouts(offset)

  if (pending.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <AutoRefresh seconds={QUEUE_REFRESH_SECONDS} />
        <Surface as="p" tone="solid" className="text-center text-sm text-muted-foreground">
          {offset === 0
            ? 'Tidak ada pengajuan yang menunggu.'
            : 'Halaman ini sudah kosong — antreannya menyusut sejak tautan ini dibuka.'}
        </Surface>
        {offset > 0 ? <PageLink offset={0}>Kembali ke awal antrean</PageLink> : null}
      </div>
    )
  }

  const first = offset + 1
  const last = offset + pending.length

  return (
    <div className="flex flex-col gap-3">
      <AutoRefresh seconds={QUEUE_REFRESH_SECONDS} />
      <p className="text-sm text-muted-foreground">
        Pengajuan {formatCredits(first)}–{formatCredits(last)}
        {hasMore ? ' dari antrean' : ''}, terlama di atas.
      </p>

      <ul className="flex flex-col gap-3">
        {pending.map((payout) => {
          const channel = getPayoutChannel(payout.channelId)

          return (
            <Surface
              as="li"
              key={payout.id}
              tone="solid"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-foreground">{payout.user.firstName}</span>
                  <span className="text-sm text-muted-foreground">{payout.user.id}</span>
                </div>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="font-semibold text-foreground">
                    {formatRupiah(payout.amountIdr)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatCredits(payout.credits)} credit
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">{channel.accountLabel}</dt>
                  <dd>
                    <CopyableAccount value={payout.accountNumber} channelName={channel.name} />
                  </dd>
                </div>

                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Nama pemilik</dt>
                  <dd className="font-medium text-foreground">{payout.accountName}</dd>
                </div>

                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Diajukan</dt>
                  <dd className="text-foreground tabular-nums">
                    {formatHistoryTime(payout.requestedAt)}
                  </dd>
                </div>

                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Konteks</dt>
                  <dd className="text-foreground tabular-nums">
                    Skor risiko {formatCredits(payout.risk.score)} (7 hari) · akun{' '}
                    {formatCredits(payout.risk.accountAgeDays)} hari
                  </dd>
                  {payout.risk.sharedDestinationAccounts > 0 ? (
                    <dd className="font-medium text-foreground tabular-nums">
                      ⚠ {formatCredits(payout.risk.sharedDestinationAccounts)} akun lain
                      menarik ke tujuan yang sama
                    </dd>
                  ) : null}
                </div>
              </dl>

              <PayoutActions
                id={payout.id}
                userName={payout.user.firstName}
                amountLabel={formatRupiah(payout.amountIdr)}
                accountLabel={`${channel.name} ${payout.accountNumber}`}
              />
            </Surface>
          )
        })}
      </ul>

      {offset > 0 || hasMore ? (
        <nav aria-label="Halaman antrean" className="flex items-center justify-between gap-3">
          {offset > 0 ? (
            <PageLink offset={Math.max(0, offset - PENDING_PAYOUT_PAGE_SIZE)}>
              Sebelumnya
            </PageLink>
          ) : (
            <span />
          )}
          {hasMore ? (
            <PageLink offset={offset + PENDING_PAYOUT_PAGE_SIZE}>Berikutnya</PageLink>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  )
}

function PageLink({ offset, children }: { offset: number; children: ReactNode }) {
  return (
    <Link
      href={offset === 0 ? '/admin/withdrawals' : `/admin/withdrawals?offset=${offset}`}
      className={actionButtonClass({ variant: 'soft', size: 'compact', className: 'w-auto' })}
    >
      {children}
    </Link>
  )
}

function CopyableAccount({ value, channelName }: { value: string; channelName: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-medium text-foreground tabular-nums">{value}</span>
      <span className="text-muted-foreground">{channelName}</span>
      <CopyButton value={value} />
    </span>
  )
}
