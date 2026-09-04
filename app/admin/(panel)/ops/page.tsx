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
import { GlyphChevron } from '@/shared/components/glyph'
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
      <div className="admin-head">
        <h1 className="admin-head-title">Operasi</h1>
        {flagged.length > 0 ? (
          <span className="chip chip-destructive">{formatCredits(flagged.length)} bersinyal</span>
        ) : null}
      </div>

      <Block
        title="Akun bersinyal · 7 hari"
        note="Sinyal tidak menghukum otomatis. Yang sedang antre payout ada di atas karena perlu ditinjau sebelum uang keluar."
        empty={flagged.length === 0 ? 'Tidak ada akun bersinyal dalam tujuh hari terakhir.' : undefined}
      >
        {flagged.map((user) => (
          <div className="admin-row" key={user.publicId}>
            <div className="admin-row-main">
              <Link
                href={`/admin/users?q=${encodeURIComponent(user.publicId)}&id=${user.publicId}`}
                className="focus-ring admin-row-title truncate"
              >
                {user.firstName}
              </Link>
              <span className="admin-sub">{user.signals.join(', ')}</span>
              <span className="admin-sub tabular-nums">
                {formatCredits(user.signalCount)} sinyal · saldo {formatCredits(user.balanceCredits)} ·{' '}
                {formatDateTime(user.lastSignalAt)}
              </span>
            </div>
            <span className={user.hasPendingPayout ? 'chip chip-destructive' : 'chip chip-muted'}>
              {user.hasPendingPayout ? 'Payout antre' : `Skor ${formatCredits(user.score)}`}
            </span>
          </div>
        ))}
      </Block>

      <section className="admin-card">
        <div>
          <h2 className="admin-eyebrow text-foreground">Arsip penarikan</h2>
          <p className="admin-sub">Cocokkan rekening dengan bukti transfer saat terjadi sengketa.</p>
        </div>

        <form action="/admin/ops" className="flex flex-col gap-2.5">
          <label className="admin-field">
            <span className="admin-field-k">Cari transaksi</span>
            <input
              name="q"
              defaultValue={term}
              placeholder="Rekening, penerima, atau nama akun"
              className="focus-ring admin-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-k">Status</span>
            <span className="admin-select-wrap">
              <select name="state" defaultValue={filter} className="focus-ring admin-input admin-select">
                <option value="semua">Semua status</option>
                <option value="processing">Diproses</option>
                <option value="paid">Terkirim</option>
                <option value="rejected">Ditolak</option>
              </select>
              <GlyphChevron direction="down" className="admin-select-icon" />
            </span>
          </label>
          <button type="submit" className="focus-ring transition-ui admin-btn admin-btn-primary">
            Terapkan filter
          </button>
        </form>

        {payouts.entries.length === 0 ? (
          <p className="admin-empty">Tidak ada penarikan yang cocok dengan filter ini.</p>
        ) : (
          <div className="admin-list">
            {payouts.entries.map((payout) => (
              <div className="admin-row" key={payout.id}>
                <div className="admin-row-main">
                  <Link
                    href={`/admin/users?q=${encodeURIComponent(payout.userPublicId)}&id=${payout.userPublicId}`}
                    className="focus-ring admin-row-title truncate"
                  >
                    {payout.userName}
                  </Link>
                  <span className="admin-sub tabular-nums">
                    {getPayoutChannel(payout.channelId).name} {payout.accountNumber} · {payout.accountName}
                  </span>
                  <span className="admin-sub tabular-nums">
                    Diajukan {formatDateTime(payout.requestedAt)}
                    {payout.settledAt ? ` · diputuskan ${formatDateTime(payout.settledAt)}` : ''}
                    {payout.processedBy ? ` oleh ${payout.processedBy}` : ''}
                    {payout.hasProof ? ' · bukti tersedia' : ''}
                  </span>
                  {payout.rejectReason ? (
                    <span className="text-xs text-destructive">Alasan: {payout.rejectReason}</span>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="admin-row-value">{formatRupiah(payout.amountIdr)}</p>
                  <p className="admin-sub">{STATE_LABEL[payout.state] ?? payout.state}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {payouts.hasMore ? (
          <p className="admin-sub">
            Menampilkan {formatCredits(payouts.entries.length)} hasil teratas. Persempit pencarian untuk sisanya.
          </p>
        ) : null}
      </section>

      <Block
        title="Tagihan premium"
        note="Pemasukan langsung dan status aktivasi setelah pembayaran lunas."
        empty={invoices.length === 0 ? 'Belum ada tagihan premium.' : undefined}
      >
        {invoices.map((invoice) => (
          <div className="admin-row" key={invoice.orderId}>
            <div className="admin-row-main">
              <Link
                href={`/admin/users?q=${encodeURIComponent(invoice.userPublicId)}&id=${invoice.userPublicId}`}
                className="focus-ring admin-row-title truncate"
              >
                {invoice.userName}
              </Link>
              <span className="admin-sub tabular-nums">
                {formatCredits(invoice.months)} bulan · {invoice.state} · {invoice.orderId}
              </span>
              <span className="admin-sub tabular-nums">
                Dibuat {formatDateTime(invoice.createdAt)}
                {invoice.paidAt ? ` · lunas ${formatDateTime(invoice.paidAt)}` : ''}
                {invoice.grantedUntil ? ` · aktif sampai ${formatDateTime(invoice.grantedUntil)}` : ''}
              </span>
            </div>
            <span className="admin-row-value">{formatRupiah(invoice.totalAmountIdr)}</span>
          </div>
        ))}
      </Block>

      <BroadcastComposer />

      <Block
        title="Siaran terakhir"
        note="Sepuluh pengiriman terbaru beserta hasilnya."
        empty={broadcasts.length === 0 ? 'Belum pernah mengirim siaran.' : undefined}
      >
        {broadcasts.map((broadcast) => (
          <div className="admin-row" key={broadcast.id}>
            <div className="admin-row-main">
              <span className="admin-row-title">
                {SEGMENT_LABEL.get(broadcast.segment) ?? broadcast.segment}
              </span>
              <span className="admin-sub line-clamp-3 whitespace-pre-wrap">{broadcast.body}</span>
              <span className="admin-sub tabular-nums">
                {formatDateTime(broadcast.createdAt)}
                {broadcast.createdBy ? ` · oleh ${broadcast.createdBy}` : ''} ·{' '}
                {broadcast.finishedAt ? 'selesai' : 'berjalan'}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <p className="admin-row-value">{formatCredits(broadcast.sentCount)}</p>
              <p className="admin-sub">
                {broadcast.failedCount > 0 ? `${formatCredits(broadcast.failedCount)} gagal` : 'terkirim'}
              </p>
            </div>
          </div>
        ))}
      </Block>

      <MaintenanceButton />
    </div>
  )
}

const STATE_LABEL: Record<string, string> = { processing: 'Diproses', paid: 'Terkirim', rejected: 'Ditolak' }

function Block({ title, note, empty, children }: { title: string; note: string; empty?: string; children: ReactNode }) {
  return (
    <section className="admin-card">
      <div>
        <h2 className="admin-eyebrow text-foreground">{title}</h2>
        <p className="admin-sub">{note}</p>
      </div>
      {empty ? <p className="admin-sub">{empty}</p> : <div className="admin-list">{children}</div>}
    </section>
  )
}
