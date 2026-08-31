'use client'

import { useMemo, useState } from 'react'
import { creditsToRupiah } from '@/domain/economy'
import { prestigeBadges, type PrestigeKey } from '@/domain/prestige'
import { EarningsChart } from '@/features/profile/earnings-chart'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import { TierGlyph } from '@/features/home/tier-glyph'
import type { UserStats } from '@/features/stats/domain'
import { VIEW_TITLE } from '@/navigation/app-view'
import { DataList, DataListRow } from '@/shared/components/data-list'
import {
  GlyphBolt,
  GlyphCheck,
  GlyphCrown,
  GlyphHistory,
  GlyphUsers,
  GlyphWallet,
} from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { PageHeader } from '@/shared/components/page-header'
import { SectionLabel } from '@/shared/components/section-label'
import { SegmentedTabs, type SegmentedTab } from '@/shared/components/segmented-tabs'
import {
  formatCredits,
  formatCreditsDecimal,
  formatRupiah,
  formatShortDate,
} from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import type { PremiumState, SessionResponse } from '@/shell/session-api'

type SessionUser = NonNullable<SessionResponse['user']>

const CHIP_TONE: Record<PrestigeKey, string> = {
  precision: 'bg-success/10 text-success',
  milestone: 'bg-primary/10 text-primary',
  premium: 'bg-premium/10 text-premium',
  founder: 'bg-foreground/10 text-foreground',
}

const RANGES = [
  { key: '7', label: '7h', days: 7 },
  { key: '30', label: '30h', days: 30 },
  { key: 'all', label: 'Semua', days: 0 },
] as const

type RangeKey = (typeof RANGES)[number]['key']

const RANGE_TABS: readonly SegmentedTab<RangeKey>[] = RANGES.map((item) => ({
  value: item.key,
  label: item.label,
}))

export function ProfileView({
  user,
  stats,
  premium,
  founder,
  onOpenPhotoNote,
}: {
  user: SessionUser
  stats: UserStats
  premium: PremiumState | null
  founder: boolean
  onOpenPhotoNote: () => void
}) {
  const [range, setRange] = useState<RangeKey>('30')
  const isPremium = Boolean(premium?.active)
  const handle = user.username ? `@${user.username}` : user.id
  const rank = stats.progression.rank

  const badges = prestigeBadges({
    taskCount: stats.completedCount,
    credits: stats.taskCredits,
    founder,
    premium: isPremium,
  })

  const series = useMemo(() => {
    const days = RANGES.find((item) => item.key === range)?.days ?? 0
    if (days === 0) return stats.earningsSeries
    return stats.earningsSeries.slice(-days)
  }, [stats.earningsSeries, range])

  const rangeCredits = series.reduce((sum, point) => sum + point.credits, 0)

  return (
    <div className="flex flex-col">
      <PageHeader title={VIEW_TITLE.profile} />

      <section aria-label="Identitas" className="region-under-brand flex items-start gap-3">
        <button
          type="button"
          onClick={onOpenPhotoNote}
          aria-label="Tentang foto profil"
          className="focus-ring press-scale-soft relative flex shrink-0 rounded-full"
        >
          <ProfileAvatar
            photoUrl={user.photoUrl}
            className={cn(
              'size-[4.5rem]',
              isPremium
                ? 'shadow-[0_0_0_2px_color-mix(in_oklab,var(--premium)_65%,transparent)]'
                : 'ring-border',
            )}
            glyphClassName="size-8"
          />
          <span
            aria-hidden="true"
            className="btn-soft absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full text-foreground"
          >
            <TierGlyph tier={rank.tier} className="size-3.5" />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-[20px] font-bold leading-tight tracking-[-0.02em] text-foreground">
            <span className="truncate">{user.firstName}</span>
            {isPremium ? <GlyphCrown className="size-4 shrink-0 text-premium" /> : null}
          </p>
          <p className="truncate text-cta leading-snug text-muted-foreground">{handle}</p>

          {badges.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {badges.map((badge) => (
                <span
                  key={badge.key}
                  title={badge.detail}
                  className={cn('rounded-md px-1.5 py-0.5 text-meta font-bold', CHIP_TONE[badge.key])}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <dl className="stack-gap-t flex flex-wrap items-center gap-x-4 gap-y-1.5 text-label text-muted-foreground">
        <MetaFact icon={<TierGlyph tier={rank.tier} className="size-3.5" />} value={rank.name} />
        <MetaFact
          icon={<GlyphCheck className="glyph-sm" />}
          value={`${formatCredits(stats.completedCount)} task`}
        />
        <MetaFact
          icon={<GlyphBolt className="glyph-sm" />}
          value={`${formatCreditsDecimal(stats.averageStars)} bintang`}
        />
        {stats.joinedAt ? (
          <MetaFact
            icon={<GlyphHistory className="glyph-sm" />}
            value={`Gabung ${formatShortDate(stats.joinedAt)}`}
          />
        ) : null}
      </dl>

      <section aria-label="Perolehan" className="region-t region-t-flush">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-4xl font-bold leading-none tracking-[-0.035em] tabular-nums text-foreground">
              {formatCredits(stats.balance)}
              <span className="ml-1.5 text-base font-semibold text-muted-foreground">credit</span>
            </p>
            <p className="mt-1.5 text-cta font-semibold tabular-nums text-success">
              +{formatCredits(rangeCredits)} periode ini
            </p>
          </div>

          <SegmentedTabs
            className="shrink-0"
            size="sm"
            ariaLabel="Rentang penghasilan"
            tabs={RANGE_TABS}
            value={range}
            onChange={setRange}
          />
        </div>

        <div className="stack-gap-t">
          <EarningsChart series={series} />
        </div>
      </section>

      <section aria-label="Saldo" className="region-t flex items-center gap-3">
        <IconCircle size="lg" tone="card">
          <GlyphWallet className="glyph-lg" />
        </IconCircle>
        <div className="min-w-0 flex-1">
          <SectionLabel>Nilai rupiah</SectionLabel>
          <p className="text-lg font-bold tracking-tight tabular-nums text-foreground">
            {formatRupiah(creditsToRupiah(stats.balance))}
          </p>
        </div>
      </section>

      <section aria-label="Rekam jejak" className="region-t">
        <SectionLabel as="h2">Rekam jejak</SectionLabel>
        <div className="stack-gap-t grid grid-cols-2 gap-2">
          <StatTile label="Streak" value={`${formatCredits(stats.streak)} hari`} />
          <StatTile label="Hari aktif" value={`${formatCredits(stats.activeDays)} hari`} />
          <StatTile label="Bintang tiga" value={`${Math.round(stats.perfectShare * 100)}%`} />
          <StatTile label="Reward terbaik" value={`+${formatCredits(stats.bestReward)}`} />
        </div>
      </section>

      <div className="region-t">
        <DataList label="Sebaran kesulitan">
          {stats.byDifficulty.map((row, index) => (
            <DataListRow
              key={row.difficulty}
              showDivider={index < stats.byDifficulty.length - 1}
              title={row.label}
              meta={`${formatCredits(row.credits)} credit terkumpul`}
              amount={
                <span className="text-cta font-bold tabular-nums text-foreground">
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
            marker={<GlyphUsers className="glyph-lg text-muted-foreground" />}
            title="Teman yang kamu ajak"
            meta={`${formatCredits(stats.activeReferralCount)} dari ${formatCredits(stats.referralCount)} aktif`}
          />
          <DataListRow
            showDivider={false}
            marker={<GlyphHistory className="glyph-lg text-muted-foreground" />}
            title="Riwayat task"
            meta={`${formatCredits(stats.completedCount)} task selesai`}
          />
        </DataList>
      </div>
    </div>
  )
}

function MetaFact({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className="text-muted-foreground/70">
        {icon}
      </span>
      <span className="font-semibold text-foreground/80">{value}</span>
    </span>
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
