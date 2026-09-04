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
  const first = offset + 1
  const last = offset + pending.length

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="admin-page-title">Antrean payout</h1>
          {pending.length > 0 ? (
            <span className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
              {pending.length} di halaman ini
            </span>
          ) : null}
        </div>
        <p className="admin-page-description">
          Verifikasi tujuan, risiko akun, dan bukti transfer sebelum menyelesaikan penarikan.
        </p>
      </header>

      <AutoRefresh seconds={QUEUE_REFRESH_SECONDS} />

      {pending.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="admin-empty">
            {offset === 0
              ? 'Antrean bersih. Tidak ada pengajuan yang menunggu diproses.'
              : 'Halaman ini sudah kosong karena antrean berubah sejak tautan dibuka.'}
          </p>
          {offset > 0 ? <PageLink offset={0}>Kembali ke awal antrean</PageLink> : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Menampilkan pengajuan {formatCredits(first)}–{formatCredits(last)}. Yang paling lama ada di atas.
            </p>
            <p className="text-xs font-medium text-muted-foreground">Periksa rekening sebelum transfer</p>
          </div>

          <ol className="flex flex-col gap-4">
            {pending.map((payout, index) => {
              const channel = getPayoutChannel(payout.channelId)
              const shared = payout.risk.sharedDestinationAccounts > 0

              return (
                <li key={payout.id}>
                  <article className="admin-panel overflow-hidden">
                    <header className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Antrean #{formatCredits(first + index)}</p>
                        <h2 className="pt-1 font-display text-lg font-bold text-foreground">{payout.user.firstName}</h2>
                        <p className="text-sm text-muted-foreground">ID {payout.user.id} · diajukan {formatHistoryTime(payout.requestedAt)}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-display text-2xl font-bold tabular-nums text-foreground">{formatRupiah(payout.amountIdr)}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">{formatCredits(payout.credits)} credit ditahan</p>
                      </div>
                    </header>

                    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
                      <div className="rounded-lg bg-muted p-3.5 sm:col-span-2 lg:col-span-1">
                        <p className="text-xs text-muted-foreground">Tujuan {channel.name}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <p className="font-display text-lg font-bold tabular-nums text-foreground">{payout.accountNumber}</p>
                          <CopyButton value={payout.accountNumber} />
                        </div>
                        <p className="pt-1 text-sm font-medium text-foreground">a.n. {payout.accountName}</p>
                        <p className="pt-1 text-xs text-muted-foreground">{channel.accountLabel}</p>
                      </div>

                      <div className="rounded-lg bg-muted p-3.5">
                        <p className="text-xs text-muted-foreground">Kondisi akun</p>
                        <p className="pt-2 text-sm font-semibold text-foreground">Usia {formatCredits(payout.risk.accountAgeDays)} hari</p>
                        <p className="pt-1 text-xs text-muted-foreground">Skor risiko {formatCredits(payout.risk.score)} dalam 7 hari</p>
                      </div>

                      <div className={shared ? 'rounded-lg border border-destructive p-3.5' : 'rounded-lg bg-muted p-3.5'}>
                        <p className="text-xs text-muted-foreground">Tujuan bersama</p>
                        <p className={shared ? 'pt-2 text-sm font-semibold text-destructive' : 'pt-2 text-sm font-semibold text-foreground'}>
                          {shared ? `${formatCredits(payout.risk.sharedDestinationAccounts)} akun lain memakai tujuan ini` : 'Tidak dipakai akun lain'}
                        </p>
                        <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                          {shared ? 'Pastikan identitas dan aktivitas akun masuk akal sebelum transfer.' : 'Tidak ada duplikasi tujuan yang terdeteksi.'}
                        </p>
                      </div>
                    </div>

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
            <nav aria-label="Halaman antrean" className="flex items-center justify-between gap-3">
              {offset > 0 ? <PageLink offset={Math.max(0, offset - PENDING_PAYOUT_PAGE_SIZE)}>Sebelumnya</PageLink> : <span />}
              {hasMore ? <PageLink offset={offset + PENDING_PAYOUT_PAGE_SIZE}>Berikutnya</PageLink> : <span />}
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
      className="focus-ring transition-ui self-start rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
    >
      {children}
    </Link>
  )
}
