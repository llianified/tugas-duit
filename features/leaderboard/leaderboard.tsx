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
import { SegmentedTabs, type SegmentedTab } from '@/shared/components/segmented-tabs'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import { ActivityFeed } from '@/features/activity/activity-feed'
import type { ActivityEntry } from '@/features/activity/domain'
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

type BoardSurface = 'papan' | 'aktivitas'

/**
 * Dua tab tingkat atas, bukan dua item nav. Papan dan umpan aktivitas menjawab
 * pertanyaan yang sama — "apa yang sedang terjadi di antara pemain lain" — hanya
 * dengan sumbu berbeda: satu peringkat kumulatif, satu urutan waktu. Menaruhnya
 * berdampingan lebih jujur daripada menambah item keenam ke nav pill yang di lebar
 * 384px sudah menyisakan 76px per item.
 */
export function LeaderboardView({
  board,
  activity,
}: {
  board: LeaderboardBoard
  activity: ActivityEntry[] | null
}) {
  const { entries, you, participants, premiumMembers } = board
  const [surface, setSurface] = useState<BoardSurface>('papan')

  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.leaderboard} />

      <div role="tablist" aria-label="Tampilan papan" className="region-under-brand flex gap-5">
        {(
          [
            ['papan', 'Papan'],
            ['aktivitas', 'Aktivitas'],
          ] as [BoardSurface, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={surface === key}
            onClick={() => setSurface(key)}
            className={cn(
              'focus-ring transition-ui border-b-2 px-1 pb-2.5 text-[15px] font-bold tracking-tight',
              surface === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {surface === 'aktivitas' ? (
        /* `flex flex-1 flex-col`, dan jaraknya dibawa masing-masing cabang di dalam
        `ActivityFeed` — bukan `region-under-brand` di pembungkus ini. Empty state
        memusatkan diri lewat `flex-1 justify-center`, jadi pembungkus tanpa tinggi
        membuatnya mengecil ke tinggi isinya dan menempel ke baris tab, sementara empty
        state tab Papan — anak langsung `view-min-h` — tetap di tengah. Kelas di sini
        yang memberi tinggi sisa itu; `region-under-brand` dipindah ke daftar dan
        kerangkanya, satu-satunya cabang yang memang butuh jarak ke baris tab.

        Catatan `region-under-brand`, bukan `region-t`, tetap berlaku untuk daftarnya:
        umpan ini blok pertama di bawah baris tab, jadi tidak ada apa pun di atasnya
        untuk dipisahkan garis. */
        <div className="flex flex-1 flex-col">
          <ActivityFeed entries={activity} />
        </div>
      ) : entries.length === 0 ? (
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
  photoUrl,
}: {
  position: number
  tier: number
  premium: boolean
  photoUrl: string | null
}) {
  return (
    <span className="relative flex shrink-0">
      <ProfileAvatar
        photoUrl={photoUrl}
        className={cn(
          'size-10',
          premium
            ? 'shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--premium)_60%,transparent)]'
            : position <= 3
              ? 'shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--primary)_60%,transparent)]'
              : 'ring-border',
        )}
        glyphClassName="size-5"
      />

      <span
        aria-hidden="true"
        className={cn(
          'absolute -bottom-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1',
          'text-[10px] font-bold tabular-nums shadow-[0_0_0_1.5px_var(--background)]',
          MEDAL_CLASS[position] ?? 'bg-muted text-muted-foreground',
        )}
      >
        {formatCredits(position)}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          'absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-card',
          'shadow-[0_0_0_1.5px_var(--background)]',
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
/** Nama, penanda "Kamu", dan chip berbagi satu baris selebar layar ponsel. Dua chip adalah
 * batas sebelum nama mulai terpotong, dan `prestigeBadges` sudah mengurutkan dari yang
 * paling langka jadi yang terpotong selalu yang paling murah. */
const BOARD_CHIP_LIMIT = 2

/**
 * Tiga besar dapat warna sendiri — emas, perak, perunggu — bukan warna primary yang
 * sama untuk ketiganya. Podium yang seluruhnya seragam menghapus satu-satunya hal yang
 * membuat posisi 1 berbeda dari posisi 3, padahal jarak antara keduanya justru yang
 * paling diperebutkan. Emas di sini TIDAK bertabrakan dengan emas premium: yang premium
 * hidup di cincin avatar dan mahkota, yang ini di lencana nomor.
 */
const MEDAL_CLASS: Record<number, string> = {
  1: 'bg-[#d4a017] text-black',
  2: 'bg-[#b8bcc4] text-black',
  3: 'bg-[#b06a3b] text-white',
}

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
  }).slice(0, BOARD_CHIP_LIMIT)
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
        <BoardFrame
          position={entry.position}
          tier={rank.tier}
          premium={entry.premium}
          photoUrl={entry.photoUrl}
        />
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
