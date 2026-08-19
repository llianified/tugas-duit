import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { readAdminActivity, readAdminDashboard, type AdminActivityEntry } from '@/server/admin-stats'
import { loadEconomyConfig } from '@/server/economy-config'
import { getSessionUser } from '@/server/session'
import { creditsToRupiah } from '@/domain/economy'
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
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Pemantauan</h2>
        <p className="text-xs text-muted-foreground">
          Hanya membaca — tidak ada yang bisa diubah dari sini.
        </p>
      </header>

      <AutoRefresh seconds={DASHBOARD_REFRESH_SECONDS} />

      <Section title="Pengguna">
        <Metric label="Total user" value={formatCompact(stats.users.total)}
          hint={stats.users.newToday > 0 ? `+${formatCredits(stats.users.newToday)} hari ini` : 'belum ada pendaftar hari ini'} />
        <Metric label="Online sekarang" value={formatCredits(stats.active.online)}
          hint="aktif dalam 5 menit terakhir" />
        <Metric label="Aktif hari ini" value={formatCredits(stats.active.daily)}
          hint="user yang menyelesaikan task" />
        <Metric label="Aktif 7 hari" value={formatCompact(stats.active.weekly)} />
        <Metric label="Aktif 30 hari" value={formatCompact(stats.active.monthly)} />
        <Metric label="Ditangguhkan" value={formatCredits(stats.users.banned)}
          hint={stats.flaggedUsers > 0 ? `${formatCredits(stats.flaggedUsers)} akun bersinyal (7 hari)` : 'tidak ada akun bersinyal'} />
      </Section>

      <Section title="Task">
        <Metric label="Task selesai" value={formatCompact(stats.tasks.total)}
          hint={`+${formatCredits(stats.tasks.today)} hari ini`} />
        <Metric label="Credit dibayar" value={formatCompact(stats.paid.totalCredits)}
          hint={formatRupiah(creditsToRupiah(stats.paid.totalCredits))} />
        <Metric label="Dibayar hari ini" value={formatCompact(stats.paid.todayCredits)}
          hint={formatRupiah(creditsToRupiah(stats.paid.todayCredits))} />
      </Section>

      <Section title="Iklan (7 hari)">
        <Metric label="Tiket dibuka" value={formatCompact(stats.ads.ticketsOpened)}
          hint={`${formatCredits(stats.ads.ticketsReady)} jadi siap pakai`} />
        <Metric label="Tiket terpakai" value={formatCompact(stats.ads.passesConsumed)}
          hint={`${formatCredits(stats.ads.ticketsReady - stats.ads.passesConsumed)} pass terbuang`} />
        <Metric label="Task dibayar iklan" value={formatCompact(stats.ads.tasksPaidByAd)}
          hint={`${formatCompact(stats.ads.tasksPaidByEnergy)} dibayar energi`} />
        <Metric label="Credit di task iklan" value={formatCompact(stats.ads.creditsOnAdTasks)}
          hint={`${formatRupiah(creditsToRupiah(stats.ads.creditsOnAdTasks))} · bandingkan dengan pendapatan Adsgram`} />
      </Section>

      <Section title="Uang">
        <Metric label="Saldo beredar" value={formatCompact(stats.outstandingCredits)}
          hint={`${formatRupiah(creditsToRupiah(stats.outstandingCredits))} · belum ditarik`} />
        <Metric label="Menunggu diproses" value={formatCredits(stats.payouts.pendingCount)}
          hint={`${formatRupiah(creditsToRupiah(stats.payouts.pendingCredits))} · antrean payout`}
          urgent={stats.payouts.pendingCount > 0} />
        <Metric label="Sudah dibayar" value={formatCredits(stats.payouts.paidCount)}
          hint={formatRupiah(creditsToRupiah(stats.payouts.paidCredits))} />
        <Metric label="Ditolak" value={formatCredits(stats.payouts.rejectedCount)} />
      </Section>

      <ActivityFeed entries={activity} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
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
    <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-2xl font-semibold tabular-nums ${urgent ? 'text-primary' : 'text-foreground'}`}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
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
  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Aktivitas terbaru</h3>
        <p className="rounded-lg bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
          Belum ada aktivitas tercatat.
        </p>
      </section>
    )
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">Aktivitas terbaru</h3>
      <ul className="flex flex-col gap-2">
        {entries.map((entry, index) => (
          <li
            key={`${entry.at}-${entry.userPublicId}-${index}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm"
          >
            <span className="font-medium text-foreground">{entry.userName}</span>
            {entry.amount === null ? null : (
              <span className="tabular-nums text-foreground">
                {entry.amount > 0 ? '+' : ''}
                {formatCredits(entry.amount)} credit
              </span>
            )}
            <span className="w-full text-xs text-muted-foreground">
              {ACTIVITY_LABEL[entry.kind]} · {formatHistoryTime(entry.at)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
