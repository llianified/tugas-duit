'use client'

import { useState, type ReactNode } from 'react'
import { TierGlyph } from '@/features/home/tier-glyph'
import { PageHeader } from '@/shared/components/page-header'
import { PageRegion } from '@/shared/components/page-region'
import { ProgressBar } from '@/shared/components/progress-bar'
import { TotalSummary } from '@/shared/components/total-summary'
import { SegmentedTabs, type SegmentedTab } from '@/shared/components/segmented-tabs'
import { VIEW_TITLE } from '@/navigation/app-view'
import type { UserStats } from '@/features/stats/domain'
import { STAR_MAX } from '@/domain/stars'
import { creditsToRupiah } from '@/domain/economy'
import {
  formatCredits,
  formatCreditsDecimal,
  formatCreditsPrecise,
  formatHistoryTime,
  formatRupiah,
} from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

interface StatsViewProps {
  stats: UserStats
}

export function StatsView({ stats }: StatsViewProps) {
  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.stats} />

      <TotalSummary
        label="Total penghasilan"
        credits={stats.earnedCredits}
        hint="Seluruh credit yang pernah masuk ke akun kamu — dari task sendiri dan komisi referral, dihitung sejak hari pertama. Angka ini nggak berkurang waktu kamu tarik dana, jadi ini bukan saldo yang bisa dicairkan sekarang."
        ariaLabel="Total penghasilan sejak awal"
        className="region-under-brand"
      />

      <StatsPanels stats={stats} />
    </div>
  )
}

type StatsPanel = 'progres' | 'task' | 'saldo' | 'tarik'

const STATS_TABS: readonly SegmentedTab<StatsPanel>[] = [
  { value: 'progres', label: 'Progres' },
  { value: 'task', label: 'Task' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'tarik', label: 'Tarik' },
]

/**
 * Enam seksi statistik ditumpuk berderet menuntut gulir hampir seribu piksel, dan tidak
 * ada satu pun pertanyaan yang butuh keenamnya sekaligus: yang mengecek progres tidak
 * sedang mengecek penarikan. Dikelompokkan jadi tiga tab, tiap jawaban muat dalam satu
 * layar — bentuk yang sama dengan beranda dan riwayat, jadi tidak ada pola baru yang
 * harus dipelajari user.
 */
function StatsPanels({ stats }: { stats: UserStats }) {
  const [panel, setPanel] = useState<StatsPanel>('progres')

  return (
    <>
      <SegmentedTabs
        tabs={STATS_TABS}
        value={panel}
        onChange={setPanel}
        ariaLabel="Kelompok statistik"
        className="region-gap-t"
      />

      <div
        key={panel}
        role="tabpanel"
        id={`panel-${panel}`}
        aria-labelledby={`tab-${panel}`}
        className="animate-fade-in flex flex-1 flex-col"
      >
        {panel === 'progres' ? (
          <>
            <ProgressSection stats={stats} />
            <DifficultySection stats={stats} />
          </>
        ) : null}
        {panel === 'task' ? <TaskSection stats={stats} /> : null}
        {panel === 'saldo' ? (
          <>
            <BalanceSection stats={stats} />
            <ReferralSection stats={stats} />
          </>
        ) : null}
        {panel === 'tarik' ? <PayoutSection stats={stats} /> : null}
      </div>

      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
    </>
  )
}

function ProgressSection({ stats }: { stats: UserStats }) {
  const { rank, nextRank, tasksToNextRank, rankProgress, rankSpan } = stats.progression
  const atTop = nextRank === null

  return (
    <StatSection label="Progres">
      <div className="label-gap-t flex items-center gap-2 text-sm font-medium">
        <span className="flex min-w-0 items-center gap-1.5 text-foreground">
          <TierGlyph tier={rank.tier} className="size-5 shrink-0 text-primary" />
          <span>{rank.name}</span>
        </span>
        {nextRank === null ? (
          <span className="text-muted-foreground">Puncak jenjang</span>
        ) : (
          <>
            <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-border/60" />
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <TierGlyph tier={nextRank.tier} className="size-5 shrink-0" />
              <span>{nextRank.name}</span>
            </span>
          </>
        )}
      </div>
      <ProgressBar
        value={atTop ? 1 : rankProgress}
        max={atTop ? 1 : rankSpan}
        tone={atTop ? 'success' : 'primary'}
        valueText={
          atTop
            ? `Rank tertinggi: ${rank.name}`
            : `${formatCredits(rankProgress)} dari ${formatCredits(rankSpan)} task menuju rank ${nextRank.name}`
        }
        className="label-gap-t"
      />
      <StatList>
        <StatRow
          label={atTop ? 'Jenjang rank' : `Task menuju rank ${nextRank.name}`}
          value={atTop ? 'Sudah tertinggi' : `${formatCredits(tasksToNextRank)} task`}
          showDivider
        />
        <StatRow
          label="Streak beraktivitas"
          value={stats.streak > 0 ? `${formatCredits(stats.streak)} hari` : 'Belum mulai'}
          showDivider
        />
        <StatRow
          label="Hari beraktivitas"
          value={`${formatCredits(stats.activeDays)} hari`}
          showDivider={false}
        />
      </StatList>
    </StatSection>
  )
}

function TaskSection({ stats }: { stats: UserStats }) {
  const hasTasks = stats.completedCount > 0

  return (
    <StatSection label="Task">
      <StatList>
        <StatRow
          label="Selesai hari ini"
          value={`${formatCredits(stats.todayCount)} task`}
          showDivider
        />
        <StatRow
          label="Bintang terkumpul"
          value={`${formatCredits(stats.totalStars)} bintang`}
          showDivider
        />
        <StatRow
          label="Rata-rata bintang"
          value={
            hasTasks
              ? `${formatCreditsDecimal(stats.averageStars)} dari ${formatCredits(STAR_MAX)}`
              : '—'
          }
          showDivider
        />
        <StatRow
          label={`Task ${formatCredits(STAR_MAX)} bintang`}
          value={`${formatCredits(stats.perfectCount)} task`}
          note={hasTasks ? `${formatPercent(stats.perfectShare)} dari semua task` : undefined}
          showDivider
        />
        <StatRow
          label="Reward terbaik"
          value={hasTasks ? `${formatCredits(stats.bestReward)} credit` : '—'}
          showDivider
        />
        <StatRow
          label="Rata-rata reward"
          value={hasTasks ? `${formatCreditsDecimal(stats.averageReward)} credit` : '—'}
          showDivider={hasTasks}
        />
        {hasTasks && stats.firstCompletedAt !== null ? (
          <StatRow
            label="Task pertama"
            value={formatHistoryTime(stats.firstCompletedAt)}
            showDivider
          />
        ) : null}
        {hasTasks && stats.lastCompletedAt !== null ? (
          <StatRow
            label="Task terakhir"
            value={formatHistoryTime(stats.lastCompletedAt)}
            showDivider={false}
          />
        ) : null}
      </StatList>
      {!hasTasks ? (
        <p className="label-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">
          Angkanya muncul setelah task pertama kamu selesai.
        </p>
      ) : null}
    </StatSection>
  )
}

function DifficultySection({ stats }: { stats: UserStats }) {
  return (
    <StatSection label="Sebaran kesulitan">
      <StatList>
        {stats.byDifficulty.map((row, index) => (
          <StatRow
            key={row.difficulty}
            label={row.label}
            value={`${formatCredits(row.count)} task`}
            note={
              row.count > 0
                ? `${formatPercent(row.share)} · ${formatCredits(row.credits)} credit`
                : 'Belum pernah'
            }
            showDivider={index !== stats.byDifficulty.length - 1}
          >
            <ProgressBar
              value={row.share * 100}
              max={100}
              valueText={`${row.label}: ${formatPercent(row.share)} dari semua task`}
              className="label-gap-t"
            />
          </StatRow>
        ))}
      </StatList>
    </StatSection>
  )
}

function BalanceSection({ stats }: { stats: UserStats }) {
  return (
    <StatSection label="Asal saldo">
      <StatList>
        <StatRow
          label="Dari task sendiri"
          value={`${formatCredits(stats.taskCredits)} credit`}
          showDivider
        />
        <StatRow
          label="Komisi referral"
          value={`${formatCreditsPrecise(stats.referralCredits)} credit`}
          showDivider
        />
        <StatRow
          label="Sudah ditarik"
          value={
            stats.withdrawnCredits > 0
              ? `−${formatCredits(stats.withdrawnCredits)} credit`
              : `${formatCredits(0)} credit`
          }
          showDivider
        />
        <StatRow
          label="Saldo sekarang"
          value={`${formatCreditsPrecise(stats.balance)} credit`}
          note={formatRupiah(creditsToRupiah(stats.balance))}
          emphasis
          showDivider={false}
        />
      </StatList>
    </StatSection>
  )
}

function ReferralSection({ stats }: { stats: UserStats }) {
  return (
    <StatSection label="Referral">
      <StatList>
        <StatRow
          label="Teman aktif"
          value={`${formatCredits(stats.activeReferralCount)} teman`}
          note="Sudah pernah mengerjakan task"
          showDivider
        />
        <StatRow
          label="Task teman"
          value={`${formatCredits(stats.downlineTasks)} task`}
          showDivider
        />
        <StatRow
          label="Komisi referral"
          value={`${formatCreditsPrecise(stats.referralCredits)} credit`}
          note="Seluruh komisi langsung masuk ke saldo"
          showDivider={false}
        />
      </StatList>
    </StatSection>
  )
}

function PayoutSection({ stats }: { stats: UserStats }) {
  return (
    <StatSection label="Penarikan">
      <StatList>
        <StatRow
          label="Terkirim"
          value={`${formatCredits(stats.paidPayoutCount)} pengajuan`}
          showDivider
        />
        <StatRow
          label="Masih diproses"
          value={`${formatCredits(stats.processingPayoutCount)} pengajuan`}
          note={
            stats.processingCredits > 0
              ? `${formatCredits(stats.processingCredits)} credit di jalan`
              : undefined
          }
          showDivider
        />
        <StatRow
          label="Total ditarik"
          value={`${formatCredits(stats.withdrawnCredits)} credit`}
          note={formatRupiah(creditsToRupiah(stats.withdrawnCredits))}
          showDivider={false}
        />
      </StatList>
    </StatSection>
  )
}

function StatSection({ label, children }: { label: string; children: ReactNode }) {
  return <PageRegion label={label}>{children}</PageRegion>
}

function StatList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn('label-gap-t [--label-trim:var(--list-row-py)] flex flex-col', className)}>
      {children}
    </dl>
  )
}

function StatRow({
  label,
  value,
  note,
  emphasis = false,
  showDivider,
  children,
}: {
  label: string
  value: string
  note?: string
  emphasis?: boolean
  showDivider: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'bleed-x flex flex-wrap items-baseline justify-between gap-x-3 pt-[var(--list-row-py)]',
        showDivider ? 'border-b border-border/60 pb-[var(--list-row-py)]' : 'pb-0',
      )}
    >
      <dt className="min-w-0 text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          emphasis ? 'text-primary' : 'text-foreground',
        )}
      >
        {value}
      </dd>
      {note ? (
        <dd className="mt-0.5 w-full text-xs leading-relaxed text-muted-foreground text-pretty">
          {note}
        </dd>
      ) : null}
      {children ? <dd className="w-full">{children}</dd> : null}
    </div>
  )
}

function formatPercent(share: number): string {
  return `${formatCredits(Math.round(share * 100))}%`
}
