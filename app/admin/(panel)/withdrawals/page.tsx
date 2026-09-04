import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayoutChannel } from '@/domain/economy/withdrawal'
import { listPendingPayouts, PENDING_PAYOUT_PAGE_SIZE } from '@/server/payout/payout'
import { getSessionUser } from '@/server/auth/session'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { AutoRefresh } from '../auto-refresh'
import { CopyButton } from './copy-button'
import { PayoutActions } from './payout-actions'

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

  return (
    <div className="admin-page">
      <div className="admin-head">
        <h1 className="admin-head-title">Payout</h1>
        {pending.length > 0 ? (
          <span className="chip chip-primary">{formatCredits(pending.length)} antre</span>
        ) : null}
      </div>

      <AutoRefresh seconds={QUEUE_REFRESH_SECONDS} />

      {pending.length === 0 ? (
        <>
          <p className="admin-empty">
            {offset === 0
              ? 'Antrean bersih. Tidak ada pengajuan yang menunggu.'
              : 'Halaman ini sudah kosong karena antrean berubah.'}
          </p>
          {offset > 0 ? <PageLink offset={0}>Kembali ke awal antrean</PageLink> : null}
        </>
      ) : (
        <>
          <p className="admin-note">Yang paling lama menunggu ada di atas. Cek rekening sebelum transfer.</p>

          <ol className="flex flex-col gap-3">
            {pending.map((payout, index) => {
              const channel = getPayoutChannel(payout.channelId)
              const shared = payout.risk.sharedDestinationAccounts > 0

              return (
                <li key={payout.id}>
                  <article className="admin-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="chip chip-muted">#{formatCredits(offset + index + 1)}</span>
                          <Link
                            href={`/admin/users?q=${encodeURIComponent(payout.user.id)}&id=${payout.user.id}`}
                            className="focus-ring truncate font-display text-sm font-bold text-foreground"
                          >
                            {payout.user.firstName}
                          </Link>
                        </div>
                        <p className="admin-sub pt-0.5">Diajukan {formatHistoryTime(payout.requestedAt)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-base font-bold tabular-nums text-foreground">
                          {formatRupiah(payout.amountIdr)}
                        </p>
                        <p className="admin-sub tabular-nums">{formatCredits(payout.credits)} credit ditahan</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-muted p-3">
                      <p className="admin-stat-k">Tujuan · {channel.name}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <p className="min-w-0 flex-1 truncate font-display text-base font-bold tabular-nums text-foreground">
                          {payout.accountNumber}
                        </p>
                        <CopyButton value={payout.accountNumber} />
                      </div>
                      <p className="pt-0.5 text-xs font-semibold text-foreground">a.n. {payout.accountName}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="chip chip-muted">Akun {formatCredits(payout.risk.accountAgeDays)} hari</span>
                      <span className={payout.risk.score > 0 ? 'chip chip-destructive' : 'chip chip-muted'}>
                        Risiko {formatCredits(payout.risk.score)}
                      </span>
                      <span className={shared ? 'chip chip-destructive' : 'chip chip-success'}>
                        {shared
                          ? `${formatCredits(payout.risk.sharedDestinationAccounts)} akun pakai rekening ini`
                          : 'Rekening unik'}
                      </span>
                    </div>

                    {shared ? (
                      <p className="admin-note" data-tone="danger">
                        Rekening yang sama dipakai akun lain. Pastikan identitas dan aktivitasnya masuk akal sebelum
                        transfer.
                      </p>
                    ) : null}

                    <PayoutActions
                      id={payout.id}
                      userName={payout.user.firstName}
                      amountLabel={formatRupiah(payout.amountIdr)}
                      accountLabel={`${channel.name} ${payout.accountNumber}`}
                    />
                  </article>
                </li>
              )
            })}
          </ol>

          {offset > 0 || hasMore ? (
            <nav aria-label="Halaman antrean" className="admin-actions">
              {offset > 0 ? (
                <PageLink offset={Math.max(0, offset - PENDING_PAYOUT_PAGE_SIZE)}>Sebelumnya</PageLink>
              ) : null}
              {hasMore ? <PageLink offset={offset + PENDING_PAYOUT_PAGE_SIZE}>Berikutnya</PageLink> : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}

function PageLink({ offset, children }: { offset: number; children: ReactNode }) {
  return (
    <Link
      href={offset === 0 ? '/admin/withdrawals' : `/admin/withdrawals?offset=${offset}`}
      className="focus-ring transition-ui admin-btn admin-btn-quiet admin-btn-grow"
    >
      {children}
    </Link>
  )
}
