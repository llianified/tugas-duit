import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readAdminActivity, readAdminDashboard, type AdminActivityEntry } from '@/server/admin/admin-stats'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { getSessionUser } from '@/server/auth/session'
import { creditsToRupiah } from '@/domain/economy/economy'
import { formatCompact, formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { AutoRefresh } from '../auto-refresh'
import { SignOutButton } from '../sign-out-button'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DASHBOARD_REFRESH_SECONDS = 30

export default async function AdminDashboardPage() {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  await loadEconomyConfig()
  const [stats, activity] = await Promise.all([readAdminDashboard(), readAdminActivity()])

  const pending = stats.payouts.pendingCount
  const flagged = stats.flaggedUsers

  return (
    <div className="admin-page">
      <div className="admin-head">
        <h1 className="admin-head-title">Pantau</h1>
        <span className="chip chip-muted">Baca saja</span>
      </div>

      <AutoRefresh seconds={DASHBOARD_REFRESH_SECONDS} />

      {pending > 0 ? (
        <Link href="/admin/withdrawals" className="focus-ring transition-ui admin-note" data-tone="danger">
          <span className="font-bold">{formatCredits(pending)} payout menunggu</span> ·{' '}
          {formatRupiah(creditsToRupiah(stats.payouts.pendingCredits))} siap ditransfer. Ketuk untuk buka antrean.
        </Link>
      ) : (
        <p className="admin-note" data-tone="success">
          Antrean payout bersih. Tidak ada uang yang menunggu keputusan.
        </p>
      )}

      {flagged > 0 ? (
        <Link href="/admin/ops" className="focus-ring transition-ui admin-note">
          <span className="font-bold text-foreground">{formatCredits(flagged)} akun bersinyal</span> perlu ditinjau di
          Operasi sebelum saldonya keluar.
        </Link>
      ) : null}

      <div className="admin-stats">
        <Stat label="Online" value={formatCredits(stats.active.online)} hint="5 menit terakhir" />
        <Stat label="Task hari ini" value={formatCompact(stats.tasks.today)} hint="selesai" />
        <Stat
          label="Credit dibayar"
          value={formatCompact(stats.paid.todayCredits)}
          hint={`${formatRupiah(creditsToRupiah(stats.paid.todayCredits))} hari ini`}
        />
      </div>

      <Block title="Pengguna" note="Pertumbuhan dan akun yang perlu diawasi.">
        <Line
          label="Total akun"
          value={formatCompact(stats.users.total)}
          hint={stats.users.newToday > 0 ? `+${formatCredits(stats.users.newToday)} hari ini` : 'Belum ada pendaftar hari ini'}
        />
        <Line label="Aktif hari ini" value={formatCredits(stats.active.daily)} hint="menyelesaikan task" />
        <Line
          label="Aktif 7 / 30 hari"
          value={`${formatCompact(stats.active.weekly)} / ${formatCompact(stats.active.monthly)}`}
        />
        <Line
          label="Ditangguhkan"
          value={formatCredits(stats.users.banned)}
          hint={flagged > 0 ? `${formatCredits(flagged)} akun bersinyal` : 'Tidak ada akun bersinyal'}
          urgent={flagged > 0}
        />
      </Block>

      <Block title="Credit" note="Nilai yang sudah dibukukan dan yang masih beredar.">
        <Line label="Task selesai" value={formatCompact(stats.tasks.total)} />
        <Line
          label="Credit dibayar"
          value={formatCompact(stats.paid.totalCredits)}
          hint={formatRupiah(creditsToRupiah(stats.paid.totalCredits))}
        />
        <Line
          label="Saldo beredar"
          value={formatCompact(stats.outstandingCredits)}
          hint={`${formatRupiah(creditsToRupiah(stats.outstandingCredits))} belum ditarik`}
        />
        <Line
          label="Payout selesai"
          value={formatCredits(stats.payouts.paidCount)}
          hint={`${formatCredits(stats.payouts.rejectedCount)} ditolak`}
        />
      </Block>

      <Block title="Iklan · 7 hari" note="Seberapa jauh tiket iklan berubah jadi task dan credit.">
        <Line
          label="Tiket dibuka"
          value={formatCompact(stats.ads.ticketsOpened)}
          hint={`${formatCredits(stats.ads.ticketsReady)} siap dipakai`}
        />
        <Line
          label="Pass terpakai"
          value={formatCompact(stats.ads.passesConsumed)}
          hint={`${formatCredits(Math.max(0, stats.ads.ticketsReady - stats.ads.passesConsumed))} tidak terpakai`}
        />
        <Line
          label="Task lewat iklan"
          value={formatCompact(stats.ads.tasksPaidByAd)}
          hint={`${formatCompact(stats.ads.tasksPaidByEnergy)} lewat energi`}
        />
        <Line
          label="Credit dari task iklan"
          value={formatCompact(stats.ads.creditsOnAdTasks)}
          hint={formatRupiah(creditsToRupiah(stats.ads.creditsOnAdTasks))}
        />
      </Block>

      <Block title="Aktivitas terbaru" note="Peristiwa terakhir dari seluruh sistem.">
        {activity.length === 0 ? (
          <p className="admin-sub">Belum ada aktivitas tercatat.</p>
        ) : (
          activity.slice(0, 12).map((entry, index) => (
            <div className="admin-row" key={`${entry.at}-${entry.userPublicId}-${index}`}>
              <div className="admin-row-main">
                <span className="admin-row-title truncate">{entry.userName}</span>
                <span className="admin-sub">
                  {ACTIVITY_LABEL[entry.kind]} · {formatHistoryTime(entry.at)}
                </span>
              </div>
              {entry.amount === null ? null : (
                <span className="admin-row-value">
                  {entry.amount > 0 ? '+' : ''}
                  {formatCredits(entry.amount)}
                </span>
              )}
            </div>
          ))
        )}
      </Block>

      <div className="admin-card">
        <SignOutButton adminName={user.firstName} />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  urgent = false,
}: {
  label: string
  value: string
  hint?: string
  urgent?: boolean
}) {
  return (
    <div className="admin-stat" data-urgent={urgent ? 'true' : undefined}>
      <span className="admin-stat-k">{label}</span>
      <span className="admin-stat-v">{value}</span>
      {hint ? <span className="admin-stat-h">{hint}</span> : null}
    </div>
  )
}

function Block({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="admin-card">
      <div>
        <h2 className="admin-eyebrow text-foreground">{title}</h2>
        <p className="admin-sub">{note}</p>
      </div>
      <div className="admin-list">{children}</div>
    </section>
  )
}

function Line({
  label,
  value,
  hint,
  urgent = false,
}: {
  label: string
  value: string
  hint?: string
  urgent?: boolean
}) {
  return (
    <div className="admin-row">
      <div className="admin-row-main">
        <span className="admin-row-title">{label}</span>
        {hint ? <span className="admin-sub">{hint}</span> : null}
      </div>
      <span className={urgent ? 'admin-row-value text-primary' : 'admin-row-value'}>{value}</span>
    </div>
  )
}

const ACTIVITY_LABEL: Record<AdminActivityEntry['kind'], string> = {
  signup: 'Mendaftar',
  task: 'Selesai task',
  commission: 'Komisi referral',
  withdrawal_hold: 'Ajukan penarikan',
  withdrawal_refund: 'Penarikan dikembalikan',
  adjustment: 'Koreksi saldo',
}
