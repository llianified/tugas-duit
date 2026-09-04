'use client'

import { useMemo, useState } from 'react'
import { creditsToRupiah } from '@/domain/economy/economy'
import { prestigeBadges, type PrestigeKey } from '@/domain/progression/prestige'
import { EarningsChart } from '@/features/profile/earnings-chart'
import { ProfileAvatar } from '@/shared/components/profile-avatar'
import { TierGlyph } from '@/shared/components/tier-glyph'
import type { UserStats } from '@/domain/progression/stats'
import { VIEW_TITLE } from '@/navigation/app-view'
import { DataList, DataListRow } from '@/shared/components/data-list'
import { GlyphCrown } from '@/shared/components/glyph'
import { PageHeader } from '@/shared/components/page-header'
import { EYEBROW_CLASS, SectionLabel } from '@/shared/components/section-label'
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

const RANGES = [
  { key: '7', label: '7h', days: 7 },
  { key: '30', label: '30h', days: 30 },
  { key: 'all', label: 'Semua', days: 0 },
] as const

type RangeKey = (typeof RANGES)[number]['key']

/** Semua angka datar halaman ini hidup di satu petak, bukan tersebar antara baris fakta inline, petak, dan daftar bertajuk seperti sebelumnya — tiga cara menampilkan pasangan label/nilai yang sama, ditumpuk berurutan. Hanya "Sebaran kesulitan" yang tetap jadi daftar karena tiap barisnya membawa dua nilai (jumlah dan credit), jadi memang tabular. */
function factTiles(stats: UserStats) {
  const tiles: { label: string; value: string }[] = [
    { label: 'Task selesai', value: formatCredits(stats.completedCount) },
    { label: 'Rata-rata bintang', value: stats.averageStars.toFixed(1) },
    { label: 'Streak', value: `${formatCredits(stats.streak)} hari` },
    { label: 'Hari aktif', value: `${formatCredits(stats.activeDays)} hari` },
    { label: 'Bintang tiga', value: `${Math.round(stats.perfectShare * 100)}%` },
    { label: 'Reward terbaik', value: `+${formatCredits(stats.bestReward)}` },
    {
      label: 'Teman aktif',
      value: `${formatCredits(stats.activeReferralCount)}/${formatCredits(stats.referralCount)}`,
    },
  ]

  if (stats.joinedAt) {
    tiles.push({ label: 'Gabung', value: formatShortDate(stats.joinedAt) })
  }

  return tiles
}

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
  const [openBadge, setOpenBadge] = useState<PrestigeKey | null>(null)
  const isPremium = Boolean(premium?.active)
  const handle = user.username ? `@${user.username}` : user.id
  const rank = stats.progression.rank

  const badges = prestigeBadges({
    taskCount: stats.completedCount,
    credits: stats.taskCredits,
    founder,
    premium: isPremium,
  })

  const openDetail = badges.find((badge) => badge.key === openBadge)?.detail ?? null

  const series = useMemo(() => {
    const days = RANGES.find((item) => item.key === range)?.days ?? 0
    if (days === 0) return stats.earningsSeries
    return stats.earningsSeries.slice(-days)
  }, [stats.earningsSeries, range])

  const rangeCredits = series.reduce((sum, point) => sum + point.credits, 0)
  const tiles = factTiles(stats)

  return (
    <div className="flex flex-col">
      <PageHeader title={VIEW_TITLE.profile} />

      <section aria-label="Identitas" className="region-under-brand flex items-center gap-3">
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
          {/* Lencana tier di avatar adalah satu-satunya penyebutan tier di badan halaman:
              pil tier di header aplikasi sudah menampilkan namanya terus-menerus, jadi
              mengulangnya lagi sebagai fakta inline cuma bikin tiga salinan hal yang sama. */}
          <span
            aria-hidden="true"
            className="btn-glass-quiet absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full text-foreground"
          >
            <TierGlyph tier={rank.tier} className="size-3.5" />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-[22px] font-bold leading-tight tracking-[-0.02em] text-foreground">
            <span className="truncate">{user.firstName}</span>
            {isPremium ? <GlyphCrown className="size-4 shrink-0 text-premium" /> : null}
          </p>
          <p className="truncate text-[15px] leading-snug text-muted-foreground">{handle}</p>

          {/* Keterangan lencana dulu ditaruh di `title=`: di WebView Telegram tidak ada
              hover, jadi ia tidak pernah terbaca. Sekarang chip-nya sendiri yang jadi
              pemicu — satu ketukan membuka keterangannya sebaris di bawah, dan bidang
              sentuhnya diperlebar `after:-inset-1.5` seperti pemicu kecil lain di app ini. */}
          {badges.length > 0 ? (
            <div className="mt-1.5">
              <div className="flex flex-wrap gap-1">
                {badges.map((badge) => {
                  const open = openBadge === badge.key
                  return (
                    <button
                      key={badge.key}
                      type="button"
                      aria-expanded={open}
                      aria-controls={open ? 'prestige-detail' : undefined}
                      onClick={() => setOpenBadge(open ? null : badge.key)}
                      className={cn(
                        'focus-ring transition-ui relative rounded-md px-1.5 py-0.5 text-[11px] font-bold',
                        'after:absolute after:-inset-1.5 after:content-[""]',
                        CHIP_TONE[badge.key],
                        open && 'ring-1 ring-current',
                      )}
                    >
                      {badge.label}
                    </button>
                  )
                })}
              </div>

              {openDetail ? (
                <p
                  id="prestige-detail"
                  role="note"
                  className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground text-pretty"
                >
                  {openDetail}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-label="Perolehan" className="region-t">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel as="h2">Perolehan</SectionLabel>

          <div className="flex shrink-0 gap-1 rounded-full bg-muted p-1">
            {RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                aria-pressed={range === item.key}
                className={cn(
                  'focus-ring transition-ui rounded-full px-2.5 py-1 text-[12px] font-bold',
                  range === item.key
                    ? 'bg-card text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nilai rupiah jadi baris kedua saldo, bukan sesi sendiri dengan ikon besar:
            angkanya turunan langsung dari credit di atasnya, jadi memisahkannya membuat
            satu nilai yang sama dibaca dua kali di dua blok berbeda. */}
        <div className="label-gap-t flex items-end justify-between gap-3">
          <p className="text-4xl font-bold leading-none tracking-[-0.035em] tabular-nums text-foreground">
            {formatCredits(stats.balance)}
            <span className="ml-1.5 text-base font-semibold text-muted-foreground">credit</span>
          </p>
          <p className="shrink-0 text-[15px] font-semibold leading-none tabular-nums text-muted-foreground">
            {formatRupiah(creditsToRupiah(stats.balance))}
          </p>
        </div>

        <p className="stack-gap-t text-[13px] font-semibold tabular-nums text-success">
          +{formatCredits(rangeCredits)} periode ini
        </p>

        <div className="label-gap-t">
          <EarningsChart series={series} />
        </div>
      </section>

      {/* Tanpa judul: keempat petak sudah punya label sendiri (`dt`), jadi
          "Rekam jejak" cuma satu lapis kata di atas kata. `aria-label` tetap ada
          supaya blok ini masih punya nama untuk pembaca layar. */}
      <section aria-label="Rekam jejak" className="region-t">
        <dl className="grid grid-cols-2 gap-2">
          {tiles.map((tile, index) => (
            <div
              key={tile.label}
              /* Jumlah petak bisa ganjil kalau tanggal gabung tidak diketahui; petak terakhir melebar penuh supaya barisnya tidak menyisakan lubang. */
              className={cn(
                'stat-tile',
                index === tiles.length - 1 && tiles.length % 2 === 1 && 'col-span-2',
              )}
            >
              <dt className={EYEBROW_CLASS}>{tile.label}</dt>
              <dd className="mt-0.5 text-lg font-bold tracking-tight tabular-nums text-foreground">
                {tile.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="region-t">
        <DataList label="Sebaran kesulitan">
          {stats.byDifficulty.map((row, index) => (
            <DataListRow
              key={row.difficulty}
              showDivider={index < stats.byDifficulty.length - 1}
              title={row.label}
              meta={`${formatCredits(row.credits)} credit`}
              amount={
                <span className="text-[15px] font-bold tabular-nums text-foreground">
                  {formatCredits(row.count)}
                </span>
              }
            />
          ))}
        </DataList>
      </div>
    </div>
  )
}
