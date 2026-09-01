'use client'

import { useMemo, useState } from 'react'
import {
  DataList,
  DataListAmount,
  DataListRow,
} from '@/shared/components/data-list'
import { EmptyState } from '@/shared/components/empty-state'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphCrown, GlyphTrophy } from '@/shared/components/glyph'
import { RankMedal } from '@/shared/components/rank-medal'
import { AvatarStack } from '@/shared/components/avatar-stack'
import { CardRail, CardRailItem } from '@/shared/components/card-rail'
import {
  FilterChip,
  SegmentedTabs,
  type FilterChipOption,
  type SegmentedTab,
} from '@/shared/components/segmented-tabs'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import { ActivityFeed } from '@/features/activity/activity-feed'
import type { ActivityEntry } from '@/features/activity/domain'
import { TierGlyph } from '@/features/home/tier-glyph'
import { cn } from '@/shared/lib/utils'
import { MetaBadge, type ChipTone } from '@/shared/components/meta-badge'
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
 * Varian `plain` (Langkah 6), bukan lagi tablist garis-bawah buatan sendiri:
 * pill-nya sudah dipakai untuk pemilih lain di app ini, dan `SegmentedTabs`
 * membawa haptic, `aria-controls`, serta pengabaian klik pada tab aktif yang
 * dulu ditulis ulang di sini. `aria-controls`-nya nyata — kedua cabang di bawah
 * merender `id` panel yang ditunjuk.
 */
const SURFACE_TABS: readonly SegmentedTab<BoardSurface>[] = [
  { value: 'papan', label: 'Papan' },
  { value: 'aktivitas', label: 'Aktivitas' },
]

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

      <SegmentedTabs
        tabs={SURFACE_TABS}
        value={surface}
        onChange={setSurface}
        ariaLabel="Tampilan papan"
        variant="plain"
        className="region-under-brand"
      />

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
        <div
          role="tabpanel"
          id="panel-aktivitas"
          aria-labelledby="tab-aktivitas"
          className="flex flex-1 flex-col"
        >
          <ActivityFeed entries={activity} />
        </div>
      ) : (
        /* Pembungkus `flex flex-1 flex-col` di sini mengambil alih peran yang dulu
        dipegang `view-min-h`: anak-anaknya tetap kolom flex dengan tinggi sisa yang
        sama, jadi empty state (`flex-1 justify-center`) dan pengganjal `view-trim-b
        flex-1` di dalam `BoardPanel` berperilaku persis seperti sebelumnya. Ia ada
        karena `aria-controls` tab Papan butuh satu elemen untuk ditunjuk. */
        <div role="tabpanel" id="panel-papan" aria-labelledby="tab-papan" className="flex flex-1 flex-col">
          {entries.length === 0 ? (
            <EmptyState
              icon={<GlyphTrophy className="glyph-md text-muted-foreground" />}
              title="Papan masih kosong"
              description="Belum ada task yang diselesaikan. Task pertama yang tuntas langsung menempati puncak papan."
            />
          ) : (
            <>
              <PodiumRail entries={entries} />

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

/** Tiga, karena itu jumlah tempat di podium — bukan angka yang boleh disetel. */
const PODIUM_SIZE = 3

/**
 * Padanan rail "Clans" fomo yang akhirnya ketemu: bukan grup (app ini tidak punya
 * entitas grup), melainkan **podium** — tiga teratas diangkat keluar dari daftar
 * jadi kartu yang bisa digeser, persis posisi rail di tab Leaderboard fomo.
 *
 * Datanya nol tambahan: `entries[0..2]` yang sudah dibaca papan ini, dan tidak ada
 * kolom, tabel, atau query baru. Itu yang membedakannya dari "Clans" yang dilewati
 * di Langkah 9 — di sana yang harus dikarang adalah entitasnya, di sini yang berubah
 * cuma di mana tiga baris yang sama itu digambar.
 *
 * Duplikasi dengan daftar di bawah disengaja dan juga apa yang fomo lakukan (rail
 * "Weekly Top Trades" berisi orang yang sama dengan papan di bawahnya): podium
 * menjawab "siapa yang menang", daftar menjawab "di mana aku relatif terhadap
 * mereka". Baris papan yang sama harus tetap ada di daftar, kalau tidak nomor 4
 * akan tampak sebagai baris pertama tanpa apa pun di atasnya.
 *
 * Rail-nya baru muncul kalau ada tiga peserta. Podium berisi satu kartu bukan
 * podium — ia cuma baris papan pertama yang dipindahkan, dan daftar di bawah sudah
 * mengerjakannya lebih baik.
 */
function PodiumRail({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length < PODIUM_SIZE) return null

  const podium = entries.slice(0, PODIUM_SIZE)
  // Peserta di bawah podium, diringkas jadi tumpukan avatar. Ini pemakaian
  // `AvatarStack` yang datanya benar-benar ada: satu tumpukan = beberapa orang,
  // bukan beberapa token milik satu orang (yang tidak punya padanan di sini).
  const chasing = entries.slice(PODIUM_SIZE)

  return (
    <section aria-label="Podium papan peringkat" className="region-under-brand">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel as="h2">Podium</SectionLabel>
        <AvatarStack
          items={chasing}
          size="sm"
          ariaLabel={`${formatCredits(chasing.length)} peserta lain di bawah podium`}
        />
      </div>

      {/* `--label-trim` membayar balik `--rail-py` (padding vertikal yang menjauhkan
      tepi pemotongan rail dari bayangan kartu — lihat `.rail`), jadi jarak ke baris
      label di atas tetap sama seperti sebelum padding itu ada. */}
      <CardRail
        ariaLabel="Tiga peserta teratas"
        className="label-gap-t [--label-trim:var(--rail-py)]"
      >
        {podium.map((entry) => (
          <CardRailItem key={entry.id}>
            <PodiumCard entry={entry} />
          </CardRailItem>
        ))}
      </CardRail>
    </section>
  )
}

/**
 * Kartu podium. Lebarnya dikunci `--rail-card-w` (9.5rem), jadi setelah padding
 * tersisa ~7rem untuk nama — karena itu `truncate`, dan karena itu pula chip
 * prestise serta jumlah peserta TIDAK ikut: keduanya sudah tampil di baris papan
 * orang yang sama, dan di ruang ini keduanya cuma memotong namanya.
 *
 * `halo="card"` pada medalinya, bukan `background`: pitanya ditumpuk di sudut
 * avatar yang berdiri di atas `.task-card`, jadi kontur pemisahnya harus berwarna
 * kartu — `background` akan menggambar lubang berwarna halaman di dalam kartu.
 */
function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className="task-card [--surface-p:0.75rem] flex h-full flex-col items-center gap-1.5 text-center">
      <span className="relative flex">
        <ProfileAvatar
          photoUrl={entry.photoUrl}
          className={cn(
            'size-12',
            entry.premium
              ? 'shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--premium)_60%,transparent)]'
              : 'shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--primary)_60%,transparent)]',
          )}
          glyphClassName="size-6"
        />

        <RankMedal
          position={entry.position}
          size="md"
          halo="card"
          className="absolute -bottom-1.5 -left-1"
        />
      </span>

      <p className="flex min-w-0 max-w-full items-center gap-1 text-[13px] font-semibold tracking-tight">
        <span className="truncate">{entry.displayName}</span>
        {entry.premium ? (
          <GlyphCrown className="size-3 shrink-0 text-premium" aria-label="Anggota premium" />
        ) : null}
      </p>

      {/* Satuannya ikut, meski ruangnya mahal: angka sebesar ini tanpa satuan bisa
      terbaca sebagai Rupiah, dan itu kesalahpahaman yang paling merugikan di app
      yang memang menukar credit ke Rupiah. Ditaruh sebaris di bawah supaya angkanya
      tetap boleh selebar kartu. */}
      <p className="num-display text-[15px]">{formatCredits(entry.credits)}</p>

      <p className="text-[11px] tabular-nums text-muted-foreground">
        credit · {formatCredits(entry.taskCount)} task
      </p>
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
      <section aria-label="Posisi kamu" className="region-under-brand task-card">
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

  const rank = getRank(you.taskCount)

  return (
    <section aria-label="Posisi kamu" className="region-under-brand task-card">
      <div className="relative">
        <SectionLabel>
          Posisi kamu
          <InfoHint label="Posisi kamu">
            Urutan kamu di antara seluruh peserta, diurutkan dari total perolehan credit — bukan dari
            jumlah task. Papannya ikut bergerak saat peserta lain menyelesaikan task.
          </InfoHint>
        </SectionLabel>
      </div>

      {/* Barisnya sengaja disusun sama dengan `BoardListItem` — bingkai peringkat,
      nama, meta, nilai di kanan — karena ini memang baris papan yang sama, cuma
      diangkat ke kartu. Angka `#` raksasa yang dulu di sini membaca seperti metrik
      hero, padahal yang dicari user adalah "di mana aku di daftar ini". */}
      <div className="label-gap-t flex items-center gap-3">
        <BoardFrame
          position={you.position}
          tier={rank.tier}
          premium={you.premium}
          photoUrl={you.photoUrl}
        />

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold tracking-tight">
            <span className="truncate">{you.displayName}</span>
            {you.premium ? (
              <GlyphCrown className="size-3.5 shrink-0 text-premium" aria-label="Anggota premium" />
            ) : null}
            <MetaBadge tone="primary">Kamu</MetaBadge>
          </p>
          {/* Jumlah task tidak ikut di baris ini. Pada 384px kolom nama tinggal ~200px
          setelah avatar dan nilai, dan "#3 dari 1.284 peserta · 326 task" terpotong di
          tengah — hitungan task-nya sudah tampil di baris papan user ini juga. */}
          <p className="mt-0.5 truncate text-[13px] tabular-nums text-muted-foreground">
            #{formatCredits(you.position)} dari {formatCredits(participants)} peserta
          </p>
        </div>

        <DataListAmount value={formatCredits(you.credits)} tone="neutral" />
      </div>
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

  const filters: readonly FilterChipOption<BoardTab>[] = [
    { value: 'all', label: `Semua ${formatCredits(entries.length)}` },
    { value: 'vip', label: `VIP ${formatCredits(vip.length)}` },
  ]

  const select = (next: BoardTab) => {
    setTab(next)
    setShown(PAGE_SIZE)
  }

  return (
    <>
      {/* Baris kontrol gaya fomo: saringan di kiri. Sisi kanan — tempat fomo menaruh
      pemilih rentang waktu — dibiarkan kosong dengan sengaja: papan ini kumulatif,
      `getLeaderboard` tidak menerima parameter waktu, dan pill "24j / 7h / 30h" yang
      tidak menyaring apa pun cuma kebohongan berbentuk kontrol. `justify-between`
      sudah dipasang supaya pemilih itu bisa masuk tanpa menyusun ulang baris ini
      kalau datanya kelak ada. */}
      <div className="region-gap-t flex items-center justify-between gap-3">
        <FilterChip
          options={filters}
          value={tab}
          onChange={select}
          ariaLabel="Saringan papan peringkat"
        />
      </div>

      {/* Bukan lagi `role="tabpanel"`: pemilihnya kini `<select>`, bukan tablist, jadi
      `aria-labelledby="tab-…"` akan menunjuk id yang tidak ada. Daftar di dalamnya
      sudah membawa `<section aria-label>` sendiri lewat `DataList`. */}
      <div key={tab} className="animate-fade-in flex flex-1 flex-col">
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
 * Bingkai peringkat: penanda posisi plus lencana bentuk tier yang menempel di sudut avatar.
 *
 * Tiga teratas memakai `RankMedal` (pita ber-notch, lihat berkasnya untuk alasan
 * bentuk & warnanya), sisanya lingkaran redam bernomor. Angka biasa milik `RankMedal`
 * TIDAK dipakai di sini: ia teks tanpa bidang, dan di atas foto profil yang warnanya
 * tidak bisa ditebak ia hilang. Kontur `halo` mengurus masalah yang sama untuk pita.
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

      {position <= 3 ? (
        <RankMedal
          position={position}
          size="sm"
          halo="background"
          className="absolute -bottom-1.5 -left-1"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1',
            'bg-muted text-[10px] font-bold tabular-nums text-muted-foreground',
            'shadow-[0_0_0_1.5px_var(--background)]',
          )}
        >
          {formatCredits(position)}
        </span>
      )}

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

const CHIP_TONE: Record<PrestigeKey, ChipTone> = {
  founder: 'neutral',
  milestone: 'primary',
  precision: 'success',
  premium: 'premium',
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
        <MetaBadge key={badge.key} tone={CHIP_TONE[badge.key]} title={badge.detail}>
          {badge.label}
        </MetaBadge>
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
          {entry.you ? <MetaBadge tone="primary">Kamu</MetaBadge> : null}
          <PrestigeChips entry={entry} />
        </span>
      }
      meta={`${rank.name} · ${formatCredits(entry.taskCount)} task`}
      amount={<DataListAmount value={formatCredits(entry.credits)} tone="neutral" />}
    />
  )
}
