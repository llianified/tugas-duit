'use client'

import { useMemo, useState } from 'react'
import {
  DataList,
  DataListAmount,
  DataListRow,
} from '@/shared/components/data-list'
import { CreditAmount } from '@/shared/components/credit-amount'
import { EmptyState } from '@/shared/components/empty-state'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphCrown, GlyphTrophy } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { SegmentedTabs, type SegmentedTab } from '@/shared/components/segmented-tabs'
import { TierGlyph } from '@/features/home/tier-glyph'
import { cn } from '@/shared/lib/utils'
import { BADGE_SHAPE, MetaBadge } from '@/shared/components/meta-badge'
import { PageHeader } from '@/shared/components/page-header'
import { PageRegion } from '@/shared/components/page-region'
import { InfoHint } from '@/shared/components/info-hint'
import { SectionLabel } from '@/shared/components/section-label'
import { VIEW_TITLE } from '@/navigation/app-view'
import { getRank } from '@/features/home/progression'
import { prestigeBadges, type PrestigeKey } from '@/domain/prestige'
import { formatCredits } from '@/shared/lib/format'
import type { LeaderboardBoard, LeaderboardEntry } from '@/features/leaderboard/domain'

export function LeaderboardView({ board }: { board: LeaderboardBoard }) {
  const { entries, you, participants, premiumMembers } = board

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

          <BoardPanel
            entries={entries}
            you={you}
            participants={participants}
            premiumMembers={premiumMembers}
          />
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

type BoardTab = 'all' | 'vip'

const PAGE_SIZE = 50

/**
 * Papan peringkat adalah satu-satunya layar di app ini tempat user melihat user lain.
 * Karena itu di sinilah status premium punya arti: badge yang cuma terlihat pemiliknya
 * bukan status, cuma dekorasi.
 *
 * Peringkatnya sendiri TIDAK disentuh premium — mengangkat pembeli ke atas orang yang
 * mengerjakan lebih banyak task akan menghancurkan satu-satunya hal yang membuat papan
 * ini layak dilihat. Yang diberikan premium adalah sumbu terpisah: tab VIP tempat mereka
 * berdiri sendiri dan tidak bisa tertimpa siapa pun, plus bingkai emas yang membuat
 * barisnya tetap terbaca berbeda di papan umum.
 */
function BoardPanel({
  entries,
  you,
  participants,
  premiumMembers,
}: {
  entries: LeaderboardEntry[]
  you: LeaderboardEntry | null
  participants: number
  premiumMembers: number
}) {
  const [tab, setTab] = useState<BoardTab>('all')
  const [shown, setShown] = useState(PAGE_SIZE)

  const vip = useMemo(() => entries.filter((entry) => entry.premium), [entries])
  const list = tab === 'vip' ? vip : entries
  const visible = list.slice(0, shown)
  const hasMore = visible.length < list.length

  const tabs: readonly SegmentedTab<BoardTab>[] = [
    { value: 'all', label: `Semua ${formatCredits(entries.length)}` },
    { value: 'vip', label: `VIP ${formatCredits(vip.length)}` },
  ]

  const select = (next: BoardTab) => {
    setTab(next)
    setShown(PAGE_SIZE)
  }

  return (
    <>
      <SegmentedTabs
        tabs={tabs}
        value={tab}
        onChange={select}
        ariaLabel="Saringan papan peringkat"
        className="region-gap-t"
      />

      <div
        key={tab}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="animate-fade-in flex flex-1 flex-col"
      >
        {tab === 'vip' && vip.length === 0 ? (
          <EmptyState
            icon={<GlyphCrown className="glyph-md text-premium" />}
            title="Belum ada VIP di papan"
            description="Barisan ini khusus anggota premium. Begitu ada yang bergabung, mahkotanya tampil di sini."
          />
        ) : (
          <>
            <PageRegion>
              <DataList
                label={tab === 'vip' ? 'Barisan VIP' : 'Perolehan teratas'}
                badge={
                  tab === 'vip'
                    ? `${formatCredits(vip.length)} dari ${formatCredits(participants)} peserta`
                    : `${formatCredits(premiumMembers)} dari ${formatCredits(participants)} premium`
                }
                ariaLabel={
                  tab === 'vip' ? 'Anggota premium di papan' : 'Papan peringkat perolehan teratas'
                }
              >
                {visible.map((entry, index) => (
                  <BoardListItem
                    key={entry.id}
                    entry={entry}
                    showDivider={index !== visible.length - 1}
                  />
                ))}
              </DataList>

              {hasMore ? (
                <ActionButton
                  variant="ghost"
                  onClick={() => setShown((current) => current + PAGE_SIZE)}
                  className="label-gap-t"
                >
                  Muat {formatCredits(Math.min(PAGE_SIZE, list.length - visible.length))} lagi
                </ActionButton>
              ) : null}
            </PageRegion>

            {tab === 'all' && you && you.position > entries[entries.length - 1].position ? (
              <PageRegion label="Barisan kamu" ariaLabel="Posisi kamu di papan peringkat">
                <ul className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
                  <BoardListItem entry={you} showDivider={false} />
                </ul>
              </PageRegion>
            ) : null}
          </>
        )}
      </div>

      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
    </>
  )
}

/**
 * Bingkai peringkat: lingkaran posisi plus lencana bentuk tier yang menempel di sudutnya.
 *
 * Tier dibedakan lewat BENTUK (`TierGlyph`), bukan lewat lima warna baru. Lima warna
 * yang harus tetap terbaca di tema terang dan gelap sekaligus akan menambah palet yang
 * tidak dipakai di mana pun lagi, dan tetap sulit dibedakan pada lingkaran 28px. Bentuk
 * terbaca tanpa itu, dan tetap terbaca oleh yang tidak bisa membedakan warna.
 *
 * Emas disimpan HANYA untuk premium supaya ia tidak bersaing dengan bahasa tier.
 */
function BoardFrame({
  position,
  tier,
  premium,
}: {
  position: number
  tier: number
  premium: boolean
}) {
  return (
    <span className="relative flex shrink-0">
      <IconCircle
        aria-hidden="true"
        size="sm"
        tone={premium ? 'muted' : position <= 3 ? 'primary' : 'muted'}
        className={cn(
          'font-semibold tabular-nums',
          premium &&
            'bg-[color-mix(in_oklab,var(--premium)_16%,transparent)] text-premium shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--premium)_55%,transparent)]',
        )}
      >
        {formatCredits(position)}
      </IconCircle>

      <span
        aria-hidden="true"
        className={cn(
          'absolute -bottom-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-card',
          'shadow-[0_0_0_1px_var(--background)]',
          premium ? 'text-premium' : 'text-foreground/65',
        )}
      >
        <TierGlyph tier={tier} className="size-3" />
      </span>
    </span>
  )
}

/**
 * Lencana prestise: seluruhnya turunan dari kolom yang sudah dibaca papan ini
 * (`task_count`, `task_credits`, `users.id`), jadi tidak ada tabel baru, tidak ada
 * jalur tulis baru, dan tidak ada satu credit pun yang berpindah. Itu syaratnya —
 * rank berhenti membayar di `rankPoolCapBonus`, dan gengsi tidak boleh menambah
 * liabilitas yang harus dibayar kolam reward.
 *
 * `premium` sengaja tidak ikut dirender di sini: mahkotanya sudah berdiri di
 * sebelah nama, dan dua penanda untuk satu hal membuat barisnya berisik.
 */
const CHIP_TONE: Record<PrestigeKey, string> = {
  founder: 'bg-foreground/10 text-foreground',
  milestone: 'bg-primary/10 text-primary',
  precision: 'bg-success/10 text-success',
  premium: '',
}

function PrestigeChips({ entry }: { entry: LeaderboardEntry }) {
  const badges = prestigeBadges({
    taskCount: entry.taskCount,
    credits: entry.credits,
    founder: entry.founder,
    premium: false,
  })
  if (badges.length === 0) return null

  return (
    <>
      {badges.map((badge) => (
        <span
          key={badge.key}
          title={badge.detail}
          className={cn(BADGE_SHAPE, 'shrink-0 font-bold', CHIP_TONE[badge.key])}
        >
          {badge.label}
        </span>
      ))}
    </>
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
        <BoardFrame position={entry.position} tier={rank.tier} premium={entry.premium} />
      }
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{entry.displayName}</span>
          {entry.premium ? (
            <GlyphCrown className="size-3.5 shrink-0 text-premium" aria-label="Anggota premium" />
          ) : null}
          {entry.you ? <MetaBadge tone="accent">Kamu</MetaBadge> : null}
          <PrestigeChips entry={entry} />
        </span>
      }
      meta={`${rank.name} · ${formatCredits(entry.taskCount)} task`}
      amount={<DataListAmount value={formatCredits(entry.credits)} tone="neutral" />}
    />
  )
}
