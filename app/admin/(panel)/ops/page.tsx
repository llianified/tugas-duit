import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayoutChannel } from '@/domain/withdrawal'
import { readFlaggedUsers, readPayoutHistory, readPremiumInvoices } from '@/server/admin-ops'
import { BROADCAST_SEGMENTS } from '@/domain/broadcast'
import { readBroadcasts } from '@/server/broadcast'
import { loadEconomyConfig } from '@/server/economy-config'
import { getSessionUser } from '@/server/session'
import { formatCredits, formatDateTime, formatRupiah } from '@/shared/lib/format'
import { BroadcastComposer } from './broadcast-composer'
import { MaintenanceButton } from './maintenance-button'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SEGMENT_LABEL = new Map(BROADCAST_SEGMENTS.map((s) => [s.id as string, s.label]))

export default async function AdminOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string }>
}) {
  const admin = await getSessionUser()
  if (!admin || admin.bannedAt || !admin.isAdmin) redirect('/admin/login')

  await loadEconomyConfig()

  const { q, state } = await searchParams
  const term = q?.trim() ?? ''
  const filter =
    state === 'paid' || state === 'rejected' || state === 'processing' ? state : 'semua'

  const [flagged, invoices, payouts, broadcasts] = await Promise.all([
    readFlaggedUsers(),
    readPremiumInvoices(),
    readPayoutHistory({ state: filter, term, offset: 0 }),
    readBroadcasts(10),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Operasi</h2>
        <p className="text-sm text-muted-foreground">
          Yang tidak muat di halaman lain: akun bersinyal, riwayat penarikan yang sudah
          diputuskan, tagihan premium, siaran, dan pemeliharaan manual.
        </p>
      </header>

      <MaintenanceButton />

      <Section
        title="Akun bersinyal (7 hari)"
        note="Sinyal hanya mencatat. Yang sedang antre payout ditaruh di atas karena itu yang menuntut keputusan sebelum uangnya keluar."
      >
        {flagged.length === 0 ? (
          <Empty>Tidak ada akun bersinyal dalam tujuh hari terakhir.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {flagged.map((user) => (
              <li key={user.publicId} className="rounded-lg bg-muted px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    href={`/admin/users?q=${encodeURIComponent(user.publicId)}&id=${user.publicId}`}
                    className="focus-ring font-medium text-foreground underline underline-offset-4"
                  >
                    {user.firstName}
                  </Link>
                  <span className="tabular-nums text-foreground">
                    skor {formatCredits(user.score)} · {formatCredits(user.signalCount)} sinyal
                  </span>
                </div>
                <p className="text-muted-foreground">{user.signals.join(', ')}</p>
                <p className="tabular-nums text-muted-foreground">
                  Saldo {formatCredits(user.balanceCredits)} credit · terakhir{' '}
                  {formatDateTime(user.lastSignalAt)}
                  {user.hasPendingPayout ? ' · ⚠ sedang antre payout' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Riwayat penarikan"
        note="Termasuk yang sudah dibayar dan ditolak. Nomor rekening ditampilkan utuh supaya bisa dicocokkan dengan bukti transfer saat ada sengketa."
      >
        <form action="/admin/ops" className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Cari</span>
            <input
              name="q"
              defaultValue={term}
              placeholder="nomor rekening, nama penerima, atau nama akun"
              className="focus-ring rounded-md bg-muted px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Status</span>
            <select
              name="state"
              defaultValue={filter}
              className="focus-ring rounded-md bg-muted px-3 py-2 text-foreground"
            >
              <option value="semua">Semua</option>
              <option value="processing">Diproses</option>
              <option value="paid">Terkirim</option>
              <option value="rejected">Ditolak</option>
            </select>
          </label>
          <button
            type="submit"
            className="focus-ring rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Terapkan
          </button>
        </form>

        {payouts.entries.length === 0 ? (
          <Empty>Tidak ada penarikan yang cocok.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {payouts.entries.map((payout) => (
              <li key={payout.id} className="rounded-lg bg-muted px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    href={`/admin/users?q=${encodeURIComponent(payout.userPublicId)}&id=${payout.userPublicId}`}
                    className="focus-ring font-medium text-foreground underline underline-offset-4"
                  >
                    {payout.userName}
                  </Link>
                  <span className="tabular-nums text-foreground">
                    {formatRupiah(payout.amountIdr)} · {STATE_LABEL[payout.state] ?? payout.state}
                  </span>
                </div>
                <p className="tabular-nums text-muted-foreground">
                  {getPayoutChannel(payout.channelId).name} {payout.accountNumber} ·{' '}
                  {payout.accountName}
                </p>
                <p className="tabular-nums text-muted-foreground">
                  Diajukan {formatDateTime(payout.requestedAt)}
                  {payout.settledAt ? ` · diputuskan ${formatDateTime(payout.settledAt)}` : ''}
                  {payout.processedBy ? ` oleh ${payout.processedBy}` : ''}
                  {payout.hasProof ? ' · ada bukti' : ''}
                </p>
                {payout.rejectReason ? (
                  <p className="text-muted-foreground">Alasan: {payout.rejectReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {payouts.hasMore ? (
          <p className="text-xs text-muted-foreground">
            Menampilkan {formatCredits(payouts.entries.length)} teratas. Persempit dengan
            pencarian untuk melihat sisanya.
          </p>
        ) : null}
      </Section>

      <Section
        title="Tagihan premium"
        note="Satu-satunya pemasukan langsung dari user. Tagihan yang lunas tapi premiumnya tidak menyala akan terlihat di sini sebagai baris paid tanpa tanggal berlaku."
      >
        {invoices.length === 0 ? (
          <Empty>Belum ada tagihan premium.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoices.map((invoice) => (
              <li key={invoice.orderId} className="rounded-lg bg-muted px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    href={`/admin/users?q=${encodeURIComponent(invoice.userPublicId)}&id=${invoice.userPublicId}`}
                    className="focus-ring font-medium text-foreground underline underline-offset-4"
                  >
                    {invoice.userName}
                  </Link>
                  <span className="tabular-nums text-foreground">
                    {formatRupiah(invoice.totalAmountIdr)} · {invoice.state}
                  </span>
                </div>
                <p className="tabular-nums text-muted-foreground">
                  {formatCredits(invoice.months)} bulan · {invoice.orderId}
                </p>
                <p className="tabular-nums text-muted-foreground">
                  Dibuat {formatDateTime(invoice.createdAt)}
                  {invoice.paidAt ? ` · lunas ${formatDateTime(invoice.paidAt)}` : ''}
                  {invoice.grantedUntil
                    ? ` · berlaku sampai ${formatDateTime(invoice.grantedUntil)}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <BroadcastComposer />

      <Section title="Siaran terakhir" note="Sepuluh terbaru, beserta hasil pengirimannya.">
        {broadcasts.length === 0 ? (
          <Empty>Belum pernah mengirim siaran.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {broadcasts.map((broadcast) => (
              <li key={broadcast.id} className="rounded-lg bg-muted px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground">
                    {SEGMENT_LABEL.get(broadcast.segment) ?? broadcast.segment}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {formatCredits(broadcast.sentCount)} terkirim
                    {broadcast.failedCount > 0
                      ? ` · ${formatCredits(broadcast.failedCount)} gagal`
                      : ''}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{broadcast.body}</p>
                <p className="tabular-nums text-muted-foreground">
                  {formatDateTime(broadcast.createdAt)}
                  {broadcast.createdBy ? ` · oleh ${broadcast.createdBy}` : ''}
                  {broadcast.finishedAt ? ' · selesai' : ' · belum selesai'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

const STATE_LABEL: Record<string, string> = {
  processing: 'diproses',
  paid: 'terkirim',
  rejected: 'ditolak',
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
