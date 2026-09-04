import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayoutChannel } from '@/domain/economy/withdrawal'
import { readFlaggedUsers, readPayoutHistory, readPremiumInvoices } from '@/server/admin/admin-ops'
import { BROADCAST_SEGMENTS } from '@/domain/messaging/broadcast'
import { readBroadcasts } from '@/server/messaging/broadcast'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { getSessionUser } from '@/server/auth/session'
import { formatCredits, formatDateTime, formatRupiah } from '@/shared/lib/format'
import { BroadcastComposer } from './broadcast-composer'
import { MaintenanceButton } from './maintenance-button'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SEGMENT_LABEL = new Map(BROADCAST_SEGMENTS.map((segment) => [segment.id as string, segment.label]))

export default async function AdminOpsPage({ searchParams }: { searchParams: Promise<{ q?: string; state?: string }> }) {
  const admin = await getSessionUser()
  if (!admin || admin.bannedAt || !admin.isAdmin) redirect('/admin/login')

  await loadEconomyConfig()
  const { q, state } = await searchParams
  const term = q?.trim() ?? ''
  const filter = state === 'paid' || state === 'rejected' || state === 'processing' ? state : 'semua'

  const [flagged, invoices, payouts, broadcasts] = await Promise.all([
    readFlaggedUsers(),
    readPremiumInvoices(),
    readPayoutHistory({ state: filter, term, offset: 0 }),
    readBroadcasts(10),
  ])

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Pusat operasi</h1>
        <p className="admin-page-description">
          Tinjau anomali, arsip transaksi, siaran pengguna, dan pemeliharaan sistem tanpa bercampur dengan pengaturan ekonomi.
        </p>
      </header>

      <section aria-labelledby="ops-priority-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Prioritas</p>
            <h2 id="ops-priority-heading" className="pt-1 font-display text-lg font-bold text-foreground">Akun bersinyal · 7 hari</h2>
          </div>
          <p className="text-xs text-muted-foreground">{formatCredits(flagged.length)} akun perlu konteks</p>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Sinyal tidak menghukum akun secara otomatis. Pengguna yang sedang antre payout ditempatkan di atas karena perlu ditinjau sebelum uang keluar.
        </p>
        {flagged.length === 0 ? <Empty>Tidak ada akun bersinyal dalam tujuh hari terakhir.</Empty> : (
          <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {flagged.map((user) => (
              <li key={user.publicId} className={user.hasPendingPayout ? 'admin-panel flex flex-col gap-3 border-destructive p-4' : 'admin-panel flex flex-col gap-3 p-4'}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/users?q=${encodeURIComponent(user.publicId)}&id=${user.publicId}`} className="focus-ring rounded font-semibold text-foreground hover:text-primary hover:underline">
                      {user.firstName}
                    </Link>
                    <p className="pt-1 text-xs text-muted-foreground">Terakhir {formatDateTime(user.lastSignalAt)}</p>
                  </div>
                  <span className={user.hasPendingPayout ? 'rounded-md border border-destructive px-2 py-1 text-xs font-semibold text-destructive' : 'rounded-md bg-muted px-2 py-1 text-xs font-semibold text-foreground'}>
                    {user.hasPendingPayout ? 'Payout menunggu' : `Skor ${formatCredits(user.score)}`}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{user.signals.join(', ')}</p>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>{formatCredits(user.signalCount)} sinyal</span>
                  <span className="tabular-nums">Saldo {formatCredits(user.balanceCredits)} credit</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section title="Arsip penarikan" note="Cari keputusan payout terdahulu dan cocokkan rekening dengan bukti transfer saat terjadi sengketa.">
        <form action="/admin/ops" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-semibold text-foreground">Cari transaksi</span>
            <input name="q" defaultValue={term} placeholder="Rekening, penerima, atau nama akun" className="focus-ring rounded-lg border border-border bg-background px-3 py-2.5 text-foreground" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-foreground">Status</span>
            <select name="state" defaultValue={filter} className="focus-ring rounded-lg border border-border bg-background px-3 py-2.5 text-foreground">
              <option value="semua">Semua status</option>
              <option value="processing">Diproses</option>
              <option value="paid">Terkirim</option>
              <option value="rejected">Ditolak</option>
            </select>
          </label>
          <button type="submit" className="focus-ring transition-ui rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Terapkan filter</button>
        </form>

        {payouts.entries.length === 0 ? <Empty>Tidak ada penarikan yang cocok.</Empty> : (
          <ul className="flex flex-col divide-y divide-border">
            {payouts.entries.map((payout) => (
              <li key={payout.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/admin/users?q=${encodeURIComponent(payout.userPublicId)}&id=${payout.userPublicId}`} className="focus-ring rounded text-sm font-semibold text-foreground hover:text-primary hover:underline">{payout.userName}</Link>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatRupiah(payout.amountIdr)} · {STATE_LABEL[payout.state] ?? payout.state}</span>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">{getPayoutChannel(payout.channelId).name} {payout.accountNumber} · {payout.accountName}</p>
                <p className="text-xs leading-relaxed tabular-nums text-muted-foreground">Diajukan {formatDateTime(payout.requestedAt)}{payout.settledAt ? ` · diputuskan ${formatDateTime(payout.settledAt)}` : ''}{payout.processedBy ? ` oleh ${payout.processedBy}` : ''}{payout.hasProof ? ' · bukti tersedia' : ''}</p>
                {payout.rejectReason ? <p className="text-xs text-destructive">Alasan: {payout.rejectReason}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {payouts.hasMore ? <p className="text-xs text-muted-foreground">Menampilkan {formatCredits(payouts.entries.length)} hasil teratas. Persempit pencarian untuk melihat sisanya.</p> : null}
      </Section>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Section title="Tagihan premium" note="Pantau pemasukan langsung dan pastikan premium aktif setelah pembayaran lunas.">
          {invoices.length === 0 ? <Empty>Belum ada tagihan premium.</Empty> : (
            <ul className="flex flex-col divide-y divide-border">
              {invoices.map((invoice) => (
                <li key={invoice.orderId} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/admin/users?q=${encodeURIComponent(invoice.userPublicId)}&id=${invoice.userPublicId}`} className="focus-ring rounded text-sm font-semibold text-foreground hover:text-primary hover:underline">{invoice.userName}</Link><span className="text-sm font-semibold tabular-nums text-foreground">{formatRupiah(invoice.totalAmountIdr)} · {invoice.state}</span></div>
                  <p className="text-xs tabular-nums text-muted-foreground">{formatCredits(invoice.months)} bulan · {invoice.orderId}</p>
                  <p className="text-xs leading-relaxed tabular-nums text-muted-foreground">Dibuat {formatDateTime(invoice.createdAt)}{invoice.paidAt ? ` · lunas ${formatDateTime(invoice.paidAt)}` : ''}{invoice.grantedUntil ? ` · aktif sampai ${formatDateTime(invoice.grantedUntil)}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <MaintenanceButton />
      </div>

      <BroadcastComposer />

      <Section title="Siaran terakhir" note="Sepuluh pengiriman terbaru beserta hasilnya.">
        {broadcasts.length === 0 ? <Empty>Belum pernah mengirim siaran.</Empty> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {broadcasts.map((broadcast) => (
              <li key={broadcast.id} className="rounded-lg bg-muted p-3.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-foreground">{SEGMENT_LABEL.get(broadcast.segment) ?? broadcast.segment}</span><span className="text-xs tabular-nums text-foreground">{formatCredits(broadcast.sentCount)} terkirim{broadcast.failedCount > 0 ? ` · ${formatCredits(broadcast.failedCount)} gagal` : ''}</span></div>
                <p className="line-clamp-3 whitespace-pre-wrap pt-2 text-sm leading-relaxed text-muted-foreground">{broadcast.body}</p>
                <p className="pt-2 text-xs tabular-nums text-muted-foreground">{formatDateTime(broadcast.createdAt)}{broadcast.createdBy ? ` · oleh ${broadcast.createdBy}` : ''} · {broadcast.finishedAt ? 'selesai' : 'berjalan'}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

const STATE_LABEL: Record<string, string> = { processing: 'Diproses', paid: 'Terkirim', rejected: 'Ditolak' }

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <section className="admin-panel flex flex-col gap-4 p-4 sm:p-5"><div><h2 className="font-display text-base font-bold text-foreground">{title}</h2><p className="pt-1 text-sm leading-relaxed text-muted-foreground">{note}</p></div>{children}</section>
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="admin-empty">{children}</p>
}
