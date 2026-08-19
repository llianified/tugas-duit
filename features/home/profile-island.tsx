'use client'

import { creditsToRupiah } from '@/domain/economy'
import { IslandDivider, IslandPill } from '@/features/home/island-pill'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import type { UserStats } from '@/features/stats/domain'
import type { SessionResponse } from '@/shell/session-api'
import { GlyphChart } from '@/shared/components/glyph'
import { TapAction } from '@/shared/components/tap-action'
import { formatCredits, formatCreditsDecimal, formatRupiah } from '@/shared/lib/format'

type SessionUser = NonNullable<SessionResponse['user']>

export function ProfileIsland({
  user,
  stats,
  isOpen,
  slideOutTo,
  onToggle,
  onClose,
  onOpenStats,
}: {
  user: SessionUser
  stats: UserStats
  isOpen: boolean
  slideOutTo?: 'left' | 'right'
  onToggle: () => void
  onClose: () => void
  onOpenStats: () => void
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
      <div className="island-region">
        <div className="island-row flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <ProfileAvatar photoUrl={user.photoUrl} className="size-8" glyphClassName="size-4" />
            <span className="truncate text-xs font-semibold leading-none text-foreground">
              {user.firstName}
            </span>
          </span>
          <span className="shrink-0 text-[11px] leading-none text-muted-foreground">{handle}</span>
        </div>
      </div>
      <IslandDivider />
      <SummaryRegion
        label="Task selesai"
        value={`${formatCredits(stats.completedCount)} · ${formatCredits(stats.activeDays)} hari aktif`}
      />
      <IslandDivider />
      <SummaryRegion
        label="Rata-rata bintang"
        value={`${formatCreditsDecimal(stats.averageStars)} · ${formatCredits(Math.round(stats.perfectShare * 100))}% sempurna`}
      />
      <IslandDivider />
      <div className="island-region">
        <div className="island-row flex items-center justify-between gap-3">
          <span className="shrink-0 text-[11px] leading-none text-muted-foreground">Saldo</span>
          <span className="shrink-0 text-xs font-semibold leading-none text-primary tabular-nums">
            {formatCredits(user.balance)} credit ·{' '}
            {formatRupiah(creditsToRupiah(user.balance))}
          </span>
        </div>
        <TapAction
          className="island-row"
          tone="neutral"
          label="Lihat statistik"
          icon={<GlyphChart className="size-4 text-muted-foreground" />}
          onClick={onOpenStats}
        />
      </div>
    </IslandPill>
  )
}

function SummaryRegion({ label, value }: { label: string; value: string }) {
  return (
    <div className="island-region">
      <div className="island-row flex items-center justify-between gap-3">
        <span className="shrink-0 text-[11px] leading-none text-muted-foreground">{label}</span>
        <span className="shrink-0 text-xs font-semibold leading-none text-foreground tabular-nums">
          {value}
        </span>
      </div>
    </div>
  )
}
