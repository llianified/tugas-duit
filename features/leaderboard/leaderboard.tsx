'use client'

import {
  DataList,
  DataListAmount,
  DataListMarker,
  DataListRow,
} from '@/shared/components/data-list'
import { CreditAmount } from '@/shared/components/credit-amount'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphTrophy } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { PageHeader } from '@/shared/components/page-header'
import { PageRegion } from '@/shared/components/page-region'
import { InfoHint } from '@/shared/components/info-hint'
import { SectionLabel } from '@/shared/components/section-label'
import { VIEW_TITLE } from '@/navigation/app-view'
import { getRank } from '@/features/home/progression'
import { formatCredits } from '@/shared/lib/format'
import type { LeaderboardBoard, LeaderboardEntry } from '@/features/leaderboard/domain'

export function LeaderboardView({ board }: { board: LeaderboardBoard }) {
  const { entries, you, participants } = board

  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.leaderboard} />

      {entries.length === 0 ? (
        <EmptyState
          icon={<GlyphTrophy className="glyph-md text-muted-foreground" />}
          title="Papan masih kosong"
          description="Belum ada task yang diselesaikan. Task pertama yang tuntas langsung menempati puncak papan."
        />
      ) : (
        <>
          <YourPosition you={you} participants={participants} />

          <PageRegion>
            <BoardList entries={entries} />
          </PageRegion>

          {you && you.position > entries[entries.length - 1].position ? (
            <PageRegion label="Barisan kamu" ariaLabel="Posisi kamu di papan peringkat">
              <ul className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
                <BoardListItem entry={you} showDivider={false} />
              </ul>
            </PageRegion>
          ) : null}

          <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
        </>
      )}
    </div>
  )
}

export function LeaderboardComingSoon() {
  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.leaderboard} />

      <EmptyState
        icon={<GlyphTrophy className="glyph-md text-muted-foreground" />}
        title="Segera hadir"
        description="Papan peringkat sedang disiapkan. Perolehan kamu tetap tercatat, jadi posisimu langsung terisi saat papannya dibuka."
      />
    </div>
  )
}

function YourPosition({
  you,
  participants,
}: {
  you: LeaderboardEntry | null
  participants: number
}) {
  if (!you) {
    return (
      <section aria-label="Posisi kamu" className="region-under-brand">
        <SectionLabel>Posisi kamu</SectionLabel>
        <p className="label-gap-t text-base font-semibold tracking-tight">
          Belum masuk papan
        </p>
        <p className="stack-gap-t text-sm leading-relaxed text-muted-foreground text-pretty">
          Selesaikan satu task untuk mulai diperingkat bersama {formatCredits(participants)}{' '}
          peserta lain.
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Posisi kamu" className="region-under-brand">
      <div className="relative">
        <SectionLabel>
          Posisi kamu
          <InfoHint label="Posisi kamu">
            Urutan kamu di antara seluruh peserta, diurutkan dari total perolehan credit — bukan dari
            jumlah task. Papannya ikut bergerak saat peserta lain menyelesaikan task.
          </InfoHint>
        </SectionLabel>
      </div>

      <CreditAmount
        prefix="#"
        value={formatCredits(you.position)}
        unit={`dari ${formatCredits(participants)} peserta`}
        size="2xl"
        tone="neutral"
        className="label-gap-t"
      />

      <p className="stack-gap-t text-sm leading-none tabular-nums text-muted-foreground">
        {formatCredits(you.credits)} credit · {formatCredits(you.taskCount)} task
      </p>
    </section>
  )
}

function BoardList({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <DataList
      label="Perolehan teratas"
      badge={`${formatCredits(entries.length)} teratas`}
      ariaLabel="Papan peringkat perolehan teratas"
    >
      {entries.map((entry, index) => (
        <BoardListItem
          key={entry.id}
          entry={entry}
          showDivider={index !== entries.length - 1}
        />
      ))}
    </DataList>
  )
}

function BoardListItem({
  entry,
  showDivider,
}: {
  entry: LeaderboardEntry
  showDivider: boolean
}) {
  const rank = getRank(entry.taskCount)

  return (
    <DataListRow
      showDivider={showDivider}
      marker={
        <DataListMarker tone={entry.position <= 3 ? 'primary' : 'muted'}>
          {formatCredits(entry.position)}
        </DataListMarker>
      }
      title={
        entry.you ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{entry.displayName}</span>
            <MetaBadge tone="accent">Kamu</MetaBadge>
          </span>
        ) : (
          entry.displayName
        )
      }
      meta={`${rank.name} · ${formatCredits(entry.taskCount)} task`}
      amount={<DataListAmount value={formatCredits(entry.credits)} tone="neutral" />}
    />
  )
}
