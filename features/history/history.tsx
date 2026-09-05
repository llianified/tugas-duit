'use client'

import { useState } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { DataList, DataListAmount, DataListRow } from '@/shared/components/data-list'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphHistory, GlyphWallet } from '@/shared/components/glyph'
import { PageHeader } from '@/shared/components/page-header'
import { SegmentedTabs, type SegmentedTab } from '@/shared/components/segmented-tabs'
import { StarRating } from '@/shared/components/star-rating'
import { TotalSummary } from '@/shared/components/total-summary'
import { VIEW_TITLE } from '@/navigation/app-view'
import { DIFFICULTY_LABEL, type HistoryEntry } from '@/domain/task/challenge'
import { WithdrawalList } from '@/features/withdraw/components/withdrawal-list'
import type { Withdrawal } from '@/domain/economy/withdrawal'
import { formatCredits, formatCreditsPrecise, formatHistoryTime } from '@/shared/lib/format'

type HistoryTab = 'task' | 'withdrawal'

const TABS: readonly SegmentedTab<HistoryTab>[] = [
  { value: 'task', label: 'Soal' },
  { value: 'withdrawal', label: 'Penarikan' },
]

const SUMMARY = {
  task: {
    label: 'Total didapat',
    ariaLabel: 'Total TD dari soal',
    hint: 'Semua TD dari soal sejak awal. Ini bukan sisa saldo kamu.',
  },
  withdrawal: {
    label: 'Total ditarik',
    ariaLabel: 'Total TD yang sudah ditarik',
    hint: 'TD yang sudah terkirim ke rekening atau e-wallet. Yang diproses belum dihitung.',
  },
} as const

export function HistoryView({
  history,
  completedCount,
  totalCredits,
  hasMore,
  loadingMore,
  onLoadMore,
  withdrawals,
  withdrawnCredits,
  processingCredits,
}: {
  history: HistoryEntry[]
  completedCount: number
  totalCredits: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  withdrawals: Withdrawal[]
  withdrawnCredits: number
  processingCredits: number
}) {
  const [tab, setTab] = useState<HistoryTab>('task')
  const summary = SUMMARY[tab]

  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.history} />

      <TotalSummary
        label={summary.label}
        credits={tab === 'task' ? totalCredits : withdrawnCredits}
        hint={summary.hint}
        ariaLabel={summary.ariaLabel}
        note={
          tab === 'withdrawal' && processingCredits > 0
            ? `${formatCreditsPrecise(processingCredits)} TD masih diproses admin.`
            : undefined
        }
        className="region-under-brand"
      />

      <SegmentedTabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Jenis riwayat"
        className="region-gap-t"
      />

      <div
        key={tab}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="animate-fade-in flex flex-1 flex-col"
      >
        {tab === 'task' ? (
          <TaskHistoryPanel
            history={history}
            completedCount={completedCount}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={onLoadMore}
          />
        ) : (
          <WithdrawalHistoryPanel withdrawals={withdrawals} />
        )}
      </div>
    </div>
  )
}

/** Blok pertama tiap panel memakai `region-under-brand`, bukan `PageRegion`. Ia yang PERTAMA di
 * bawah baris tab, jadi tidak ada apa pun di atasnya untuk dipisahkan garis — alasan yang sama
 * dengan umpan aktivitas di papan peringkat. `region-t` milik `PageRegion` membawa border beserta
 * paddingnya sendiri, sehingga jarak tab ke isi jadi 20px ke garis lalu 20px lagi ke isinya,
 * sementara ribbon ke ringkasan dan ringkasan ke tab masing-masing 20px. Sekarang ketiganya sama
 * dan garisnya hilang. */
function TaskHistoryPanel({
  history,
  completedCount,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  history: HistoryEntry[]
  completedCount: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon={<GlyphHistory className="glyph-md text-muted-foreground" />}
        title="Belum ada transaksi"
        description="Kerjain soal pertama kamu. Transaksinya muncul di sini."
      />
    )
  }

  return (
    <>
      <div className="region-under-brand">
        <HistoryList history={history} completedCount={completedCount} />
        {hasMore ? (
          <ActionButton
            variant="ghost"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="label-gap-t"
          >
            {loadingMore ? 'Memuat…' : 'Muat lagi'}
          </ActionButton>
        ) : null}
      </div>

      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
    </>
  )
}

function WithdrawalHistoryPanel({ withdrawals }: { withdrawals: Withdrawal[] }) {
  if (withdrawals.length === 0) {
    return (
      <EmptyState
        icon={<GlyphWallet className="glyph-md text-muted-foreground" />}
        title="Belum ada penarikan"
        description="Penarikan bakal muncul di sini beserta statusnya."
      />
    )
  }

  return (
    <>
      <div className="region-under-brand">
        <WithdrawalList withdrawals={withdrawals} />
      </div>

      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
    </>
  )
}

function HistoryList({
  history,
  completedCount,
}: {
  history: HistoryEntry[]
  completedCount: number
}) {
  return (
    <DataList
      label="Soal selesai"
      badge={`${completedCount} soal`}
      ariaLabel="Riwayat soal yang udah kelar"
    >
      {history.map((entry, index) => (
        <HistoryListItem
          key={entry.id}
          entry={entry}
          showDivider={index !== history.length - 1}
        />
      ))}
    </DataList>
  )
}

function HistoryListItem({
  entry,
  showDivider,
}: {
  entry: HistoryEntry
  showDivider: boolean
}) {
  return (
    <DataListRow
      showDivider={showDivider}
      title={entry.title}
      meta={
        <>
          {DIFFICULTY_LABEL[entry.difficulty]} ·{' '}
          <time dateTime={new Date(entry.completedAt).toISOString()}>
            {formatHistoryTime(entry.completedAt)}
          </time>
        </>
      }
      amount={
        <>
          <DataListAmount value={`+${formatCredits(entry.reward)}`} />
          <StarRating stars={entry.stars} />
        </>
      }
    />
  )
}
