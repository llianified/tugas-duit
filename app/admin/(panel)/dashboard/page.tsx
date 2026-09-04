import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readAdminActivity, readAdminDashboard, type AdminActivityEntry } from '@/server/admin/admin-stats'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { getSessionUser } from '@/server/auth/session'
import { creditsToRupiah } from '@/domain/economy/economy'
import { formatCompact, formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { AutoRefresh } from '../auto-refresh'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DASHBOARD_REFRESH_SECONDS = 30

export default async function AdminDashboardPage() {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  await loadEconomyConfig()
  const [stats, activity] = await Promise.all([readAdminDashboard(), readAdminActivity()])

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Ringkasan langsung</p>
        <h1 className="admin-page-title">Kondisi Tugas Duit</h1>
        <p className="admin-page-description">
          Prioritas operasional, aktivitas pengguna, dan arus credit dalam satu tampilan baca-saja.
        </p>
      </header>

      <AutoRefresh seconds={DASHBOARD_REFRESH_SECONDS} />

      <section aria-labelledby="priority-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="priority-heading" className="font-display text-lg font-bold text-foreground">Perlu diketahui sekarang</h2>
          {stats.payouts.pendingCount > 0 ? (
            <Link href="/admin/withdrawals" className="focus-ring rounded-md text-xs font-semibold text-primary hover:underline">
              Buka antrean
            </Link>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Payout menunggu"
            value={formatCredits(stats.payouts.pendingCount)}
            hint={formatRupiah(creditsToRupiah(stats.payouts.pendingCredits))}
            urgent={stats.payouts.pendingCount > 0}
          />
          <Metric label="Online sekarang" value={formatCredits(stats.active.online)} hint="5 menit terakhir" />
          <Metric label="Task hari ini" value={formatCompact(stats.tasks.today)} hint="selesai" />
          <Metric
            label="Dibayar hari ini"
            value={formatCompact(stats.paid.todayCredits)}
            hint={formatRupiah(creditsToRupiah(stats.paid.todayCredits))}
          />
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Section title="Pengguna" description="Pertumbuhan, aktivitas, dan akun yang perlu diawasi.">
            <Metric
              label="Total pengguna"
              value={formatCompact(stats.users.total)}
              hint={stats.users.newToday > 0 ? `+${formatCredits(stats.users.newToday)} hari ini` : 'Belum ada pendaftar hari ini'}
            />
            <Metric label="Aktif hari ini" value={formatCredits(stats.active.daily)} hint="menyelesaikan task" />
            <Metric label="Aktif 7 hari" value={formatCompact(stats.active.weekly)} />
            <Metric label="Aktif 30 hari" value={formatCompact(stats.active.monthly)} />
            <Metric
              label="Ditangguhkan"
              value={formatCredits(stats.users.banned)}
              hint={stats.flaggedUsers > 0 ? `${formatCredits(stats.flaggedUsers)} akun bersinyal` : 'Tidak ada akun bersinyal'}
              urgent={stats.flaggedUsers > 0}
            />
          </Section>

          <Section title="Task dan credit" description="Volume kerja serta nilai reward yang sudah dibukukan.">
            <Metric label="Task selesai" value={formatCompact(stats.tasks.total)} />
            <Metric
              label="Credit dibayar"
              value={formatCompact(stats.paid.totalCredits)}
              hint={formatRupiah(creditsToRupiah(stats.paid.totalCredits))}
            />
            <Metric
              label="Saldo beredar"
              value={formatCompact(stats.outstandingCredits)}
              hint={`${formatRupiah(creditsToRupiah(stats.outstandingCredits))} belum ditarik`}
            />
            <Metric
              label="Payout selesai"
              value={formatCredits(stats.payouts.paidCount)}
              hint={formatRupiah(creditsToRupiah(stats.payouts.paidCredits))}
            />
            <Metric label="Payout ditolak" value={formatCredits(stats.payouts.rejectedCount)} />
          </Section>

          <Section title="Iklan · 7 hari" description="Konversi tiket iklan menjadi akses task dan credit.">
            <Metric
              label="Tiket dibuka"
              value={formatCompact(stats.ads.ticketsOpened)}
              hint={`${formatCredits(stats.ads.ticketsReady)} siap dipakai`}
            />
            <Metric
              label="Pass terpakai"
              value={formatCompact(stats.ads.passesConsumed)}
              hint={`${formatCredits(stats.ads.ticketsReady - stats.ads.passesConsumed)} tidak terpakai`}
            />
            <Metric
              label="Task lewat iklan"
              value={formatCompact(stats.ads.tasksPaidByAd)}
              hint={`${formatCompact(stats.ads.tasksPaidByEnergy)} lewat energi`}
            />
            <Metric
              label="Credit dari task iklan"
              value={formatCompact(stats.ads.creditsOnAdTasks)}
              hint={formatRupiah(creditsToRupiah(stats.ads.creditsOnAdTasks))}
            />
          </Section>
        </div>

        <ActivityFeed entries={activity} />
      </div>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="admin-panel flex flex-col gap-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
        <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{children}</div>
    </section>
  )
}

function Metric({
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
    <div className="flex min-h-28 flex-col justify-between gap-3 rounded-lg bg-muted p-3.5">
      <span className="text-xs leading-tight text-muted-foreground">{label}</span>
      <div>
        <span className={urgent ? 'font-display text-2xl font-bold tabular-nums text-primary' : 'font-display text-2xl font-bold tabular-nums text-foreground'}>
          {value}
        </span>
        {hint ? <span className="block pt-1 text-xs leading-relaxed text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  )
}

const ACTIVITY_LABEL: Record<AdminActivityEntry['kind'], string> = {
  signup: 'Mendaftar',
  task: 'Menyelesaikan task',
  commission: 'Komisi referral',
  withdrawal_hold: 'Mengajukan penarikan',
  withdrawal_refund: 'Penarikan dikembalikan',
  adjustment: 'Koreksi saldo',
}

function ActivityFeed({ entries }: { entries: AdminActivityEntry[] }) {
  return (
    <section className="admin-panel flex flex-col gap-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-base font-bold text-foreground">Aktivitas terbaru</h2>
        <p className="pt-1 text-xs text-muted-foreground">Peristiwa terbaru dari seluruh sistem.</p>
      </div>
      {entries.length === 0 ? (
        <p className="admin-empty">Belum ada aktivitas tercatat.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {entries.map((entry, index) => (
            <li key={`${entry.at}-${entry.userPublicId}-${index}`} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold text-foreground">{entry.userName}</span>
                {entry.amount === null ? null : (
                  <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                    {entry.amount > 0 ? '+' : ''}{formatCredits(entry.amount)} credit
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {ACTIVITY_LABEL[entry.kind]} · {formatHistoryTime(entry.at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
