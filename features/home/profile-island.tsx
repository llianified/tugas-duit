'use client'

import { IslandDivider, IslandPill, IslandStat } from '@/features/home/island-pill'
import { ProfileAvatar } from '@/shared/components/profile-avatar'
import type { UserStats } from '@/domain/progression/stats'
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
  promoted = false,
  onToggle,
  onClose,
  onOpenStats,
}: {
  user: SessionUser
  stats: UserStats
  premium?: PremiumState | null
  isOpen: boolean
  /** Saat island lain terbuka, pill ini yang mengisi pita: pindah ke tengah dan melebar jadi kapsul bernama. */
  promoted?: boolean
  onToggle: () => void
  onClose: () => void
  onOpenStats?: () => void
}) {
  const handle = user.username ? `@${user.username}` : user.id
  const isPremium = Boolean(premium?.active)
  const pillName = user.username ? `@${user.username}` : user.firstName

  return (
    <IslandPill
      panelId="profile-island"
      pillLabel={
        <span className="flex min-w-0 items-center">
          <ProfileAvatar
            photoUrl={user.photoUrl}
            className="aspect-square h-full"
            glyphClassName="size-4"
          />
          <span className="island-pill-name truncate text-[11px] font-semibold text-foreground">
            {pillName}
          </span>
        </span>
      }
      pillTitle={user.firstName}
      openLabel="Buka ringkasan profil"
      closeLabel="Tutup ringkasan profil"
      srSummary={`, ${user.firstName}, ${formatCredits(stats.completedCount)} task selesai`}
      isOpen={isOpen}
      promoted={promoted}
      onToggle={onToggle}
      onClose={onClose}
      className="island-promotable mr-1.5"
      pillClassName={cn(
        'overflow-hidden p-0',
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
            {isPremium ? <GlyphCrown className="size-3.5 shrink-0 text-premium" /> : null}
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
            className="focus-ring transition-ui island-region flex w-full items-center justify-center rounded-md text-[13px] font-bold text-primary hover:text-primary-hover active:text-primary-active"
          >
            Buka statistik
          </button>
        </>
      ) : null}
    </IslandPill>
  )
}
