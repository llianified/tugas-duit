'use client'

import { creditsToRupiah } from '@/domain/economy'
import { prestigeBadges, type PrestigeKey } from '@/domain/prestige'
import { TierGlyph } from '@/features/home/tier-glyph'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import type { UserStats } from '@/features/stats/domain'
import { DataList, DataListRow } from '@/shared/components/data-list'
import { GlyphCrown, GlyphHistory, GlyphUsers } from '@/shared/components/glyph'
import { PageHeader } from '@/shared/components/page-header'
import { PageRegion } from '@/shared/components/page-region'
import { SectionLabel } from '@/shared/components/section-label'
import { VIEW_TITLE } from '@/navigation/app-view'
import { formatCredits, formatRupiah, formatShortDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import type { PremiumState, SessionResponse } from '@/shell/session-api'

type SessionUser = NonNullable<SessionResponse['user']>

const CHIP_TONE: Record<PrestigeKey, string> = {
  precision: 'bg-success/10 text-success',
  milestone: 'bg-primary/10 text-primary',
  premium: 'bg-premium/10 text-premium',
  founder: 'bg-foreground/10 text-foreground',
}

export function ProfileView({
  user,
  stats,
  premium,
  founder,
}: {
  user: SessionUser
  stats: UserStats
  premium: PremiumState | null
  founder: boolean
}) {
  const isPremium = Boolean(premium?.active)
  const handle = user.username ? `@${user.username}` : user.id
  const rank = stats.progression.rank

  const badges = prestigeBadges({
    taskCount: stats.completedCount,
    credits: stats.taskCredits,
    founder,
    premium: isPremium,
  })

  return (
    <div className="flex flex-col">
      <PageHeader title={VIEW_TITLE.profile} />

      <section aria-label="Identitas" className="region-t flex items-center gap-3">
        <span className="relative flex shrink-0">
          <ProfileAvatar
            photoUrl={user.photoUrl}
            className={cn(
              'size-16',
              isPremium
                ? 'shadow-[0_0_0_2px_color-mix(in_oklab,var(--premium)_65%,transparent)]'
                : 'ring-border',
            )}
            glyphClassName="size-7"
          />
          <span
            aria-hidden="true"
            className={cn(
              'absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-card',
              'shadow-[0_0_0_2px_var(--background)]',
              isPremium ? 'text-premium' : 'text-foreground/70',
            )}
          >
            <TierGlyph tier={rank.tier} className="size-4" />
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-xl font-bold tracking-tight text-foreground">
            <span className="truncate">{user.firstName}</span>
            {isPremium ? <GlyphCrown className="size-4 shrink-0 text-premium" /> : null}
          </p>
          <p className="truncate text-[15px] text-muted-foreground">{handle}</p>
          <p className="mt-1 text-[13px] font-semibold text-primary">{rank.name}</p>
        </div>
      </section>

      {badges.length > 0 ? (
        <div className="stack-gap-t flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.key}
              title={badge.detail}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-bold',
                CHIP_TONE[badge.key],
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      <p className="stack-gap-t text-[13px] leading-relaxed text-muted-foreground">
        {formatCredits(stats.completedCount)} task &middot; rata-rata{' '}
        {stats.averageStars.toFixed(1)} bintang
        {stats.joinedAt ? <> &middot; gabung {formatShortDate(stats.joinedAt)}</> : null}
      </p>

      <PageRegion label="Saldo">
        <p className="text-4xl font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
          {formatCredits(stats.balance)}
          <span className="ml-2 text-sm font-semibold text-muted-foreground">credit</span>
        </p>
        <p className="stack-gap-t text-[15px] tabular-nums text-muted-foreground">
          {formatRupiah(creditsToRupiah(stats.balance))}
        </p>
      </PageRegion>

      <PageRegion label="Rekam jejak">
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Streak" value={`${formatCredits(stats.streak)} hari`} />
          <StatTile label="Hari aktif" value={`${formatCredits(stats.activeDays)} hari`} />
          <StatTile
            label="Bintang tiga"
            value={`${Math.round(stats.perfectShare * 100)}%`}
          />
          <StatTile
            label="Reward terbaik"
            value={`+${formatCredits(stats.bestReward)} credit`}
          />
        </div>
      </PageRegion>

      <div className="region-t">
        <DataList label="Sebaran kesulitan">
          {stats.byDifficulty.map((row, index) => (
            <DataListRow
              key={row.difficulty}
              showDivider={index < stats.byDifficulty.length - 1}
              title={row.label}
              meta={`${formatCredits(row.credits)} credit terkumpul`}
              amount={
                <span className="text-[15px] font-bold tabular-nums text-foreground">
                  {formatCredits(row.count)}
                </span>
              }
            />
          ))}
        </DataList>
      </div>

      <div className="region-t">
        <DataList label="Ringkasan lain">
          <DataListRow
            showDivider
            marker={<GlyphUsers className="size-5 text-muted-foreground" />}
            title="Teman yang kamu ajak"
            meta={`${formatCredits(stats.activeReferralCount)} dari ${formatCredits(stats.referralCount)} aktif`}
          />
          <DataListRow
            marker={<GlyphHistory className="size-5 text-muted-foreground" />}
            title="Riwayat task"
            meta={`${formatCredits(stats.completedCount)} task selesai`}
            showDivider={false}
          />
        </DataList>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-0.5 text-lg font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}
