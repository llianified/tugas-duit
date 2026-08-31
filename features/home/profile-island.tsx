'use client'

import { IslandDivider, IslandPill, IslandStat } from '@/features/home/island-pill'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import type { UserStats } from '@/features/stats/domain'
import type { PremiumState, SessionResponse } from '@/shell/session-api'
import { GlyphCrown } from '@/shared/components/glyph'
import { formatCredits, formatCreditsDecimal, formatShortDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

type SessionUser = NonNullable<SessionResponse['user']>

export function ProfileIsland({
  user,
  stats,
  premium = null,
  isOpen,
  slideOutTo,
  onToggle,
  onClose,
  onOpenStats,
}: {
  user: SessionUser
  stats: UserStats
  premium?: PremiumState | null
  isOpen: boolean
  slideOutTo?: 'left' | 'right'
  onToggle: () => void
  onClose: () => void
  onOpenStats?: () => void
}) {
  const handle = user.username ? `@${user.username}` : user.id
  const isPremium = Boolean(premium?.active)

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
      pillClassName={cn(
        'w-[var(--brand-pill-h)] overflow-hidden p-0',
        isPremium && 'shadow-[0_0_0_1.5px_var(--premium)]',
      )}
    >
      <IslandStat
        label={
          <span className="flex min-w-0 items-center gap-2">
            <ProfileAvatar photoUrl={user.photoUrl} className="size-5" glyphClassName="size-3" />
            <span className="truncate text-xs font-semibold text-foreground">
              {user.firstName}
            </span>
            {isPremium ? <GlyphCrown className="glyph-sm shrink-0 text-premium" /> : null}
          </span>
        }
        tone="muted"
        value={handle}
      />
      <IslandDivider />
      {isPremium && premium ? (
        <>
          <IslandStat
            label="Premium"
            tone="success"
            value={`Aktif · ${formatCredits(premium.daysLeft)} hari lagi`}
          />
          <IslandDivider />
        </>
      ) : null}
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
      {onOpenStats ? (
        <>
          <IslandDivider />
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenStats()
            }}
            className="focus-ring transition-ui island-region flex w-full items-center justify-center rounded-md text-label font-semibold text-primary hover:text-primary-hover active:text-primary-active"
          >
            Buka statistik
          </button>
        </>
      ) : null}
    </IslandPill>
  )
}
