'use client'

import type { ActivityEntry } from '@/features/activity/domain'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import { DIFFICULTY_LABEL, type Difficulty } from '@/features/captcha/domain'
import { DataListSkeleton } from '@/shared/components/app-skeleton'
import { DataList, DataListRow } from '@/shared/components/data-list'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphBolt } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'

export function ActivityFeed({ entries }: { entries: ActivityEntry[] | null }) {
  if (entries === null) return <DataListSkeleton marker />

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<GlyphBolt className="glyph-lg" />}
        title="Belum ada aktivitas"
        description="Task bintang tiga dan penarikan yang sudah dibayar bakal muncul di sini."
      />
    )
  }

  return (
    <DataList label="Aktivitas terbaru" ariaLabel="Aktivitas semua pemain">
      {entries.map((entry, index) => (
        <DataListRow
          key={entry.id}
          showDivider={index < entries.length - 1}
          marker={
            <ProfileAvatar
              photoUrl={entry.photoUrl}
              className="size-9 ring-border"
              glyphClassName="size-4"
            />
          }
          title={
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{entry.displayName}</span>
              {entry.kind === 'payout' ? (
                <MetaBadge tone="accent">Cair</MetaBadge>
              ) : (
                <MetaBadge>{difficultyLabel(entry.difficulty)}</MetaBadge>
              )}
            </span>
          }
          meta={
            entry.kind === 'payout'
              ? `Penarikan dibayar · ${formatHistoryTime(entry.at)}`
              : `Bintang tiga · ${formatHistoryTime(entry.at)}`
          }
          amount={
            <span className="text-cta font-semibold tabular-nums text-success">
              {entry.kind === 'payout'
                ? formatRupiah(entry.amount)
                : `+${formatCredits(entry.amount)}`}
            </span>
          }
        />
      ))}
    </DataList>
  )
}

function difficultyLabel(value: string | null): string {
  if (value === null) return 'Task'
  return DIFFICULTY_LABEL[value as Difficulty] ?? value
}
