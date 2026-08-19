'use client'

import { IslandDivider, IslandPill, IslandStat } from '@/features/home/island-pill'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import type { UserStats } from '@/features/stats/domain'
import type { SessionResponse } from '@/shell/session-api'
import { formatCredits, formatCreditsDecimal, formatShortDate } from '@/shared/lib/format'

type SessionUser = NonNullable<SessionResponse['user']>

export function ProfileIsland({
  user,
  stats,
  isOpen,
  slideOutTo,
  onToggle,
  onClose,
}: {
  user: SessionUser
  stats: UserStats
  isOpen: boolean
  slideOutTo?: 'left' | 'right'
  onToggle: () => void
  onClose: () => void
}) {
  const handle = user.username ? `@${user.username}` : user.id

  return (
    <IslandPill
      panelId="profile-island"
      pillLabel={<ProfileAvatar photoUrl={user.photoUrl} className="size-full" />}
      pillTitle={user.firstName}
      openLabel="Buka ringkasan profil"
      closeLabel="Tutup ringkasan profil"
      srSummary={`, ${user.firstName}, ${formatCredits(stats.completedCount)} task selesai`}
      isOpen={isOpen}
      slideOutTo={slideOutTo}
      onToggle={onToggle}
      onClose={onClose}
      className="mr-1.5"
      pillClassName="w-[var(--brand-pill-h)] overflow-hidden p-0"
    >
      <IslandStat
        label={
          <span className="flex min-w-0 items-center gap-2">
            <ProfileAvatar photoUrl={user.photoUrl} className="size-5" glyphClassName="size-3" />
            <span className="truncate text-xs font-semibold text-foreground">
              {user.firstName}
            </span>
          </span>
        }
        tone="muted"
        value={handle}
      />
      <IslandDivider />
      <IslandStat
        label="Gabung"
        tone="muted"
        value={stats.joinedAt === null ? 'Baru banget' : formatShortDate(stats.joinedAt)}
      />
      <IslandDivider />
      <IslandStat
        label="Task selesai"
        value={`${formatCredits(stats.completedCount)} · ${formatCredits(stats.activeDays)} hari aktif`}
      />
      <IslandDivider />
      <IslandStat
        label="Rata-rata bintang"
        value={`${formatCreditsDecimal(stats.averageStars)} · ${formatCredits(Math.round(stats.perfectShare * 100))}% sempurna`}
      />
      <IslandDivider />
      <IslandStat
        label="Teman diajak"
        tone={stats.referralCount > 0 ? 'success' : 'muted'}
        value={
          stats.referralCount === 0
            ? 'Belum ada'
            : `${formatCredits(stats.referralCount)} · +${formatCredits(stats.referralCredits)} credit`
        }
      />
    </IslandPill>
  )
}
