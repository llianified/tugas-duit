'use client'

import { CardRail, CardRailItem } from '@/shared/components/card-rail'
import { SURFACE_CARD_CLASS } from '@/shared/components/surface-card'
import { cn } from '@/shared/lib/utils'

/** `tone="on-muted"` untuk bar yang berdiri di atas permukaan `--muted`. Bar default berwarna `--muted` supaya terlihat di atas latar view. Di dalam kartu yang latarnya sendiri `--muted` (kartu misi, `stat-tile`, tab aktif strip tab) bar itu lenyap — bukan "kalem", tapi benar-benar tidak terlihat, sehingga kerangkanya menggambar kotak kosong alih-alih baris yang sedang dimuat. */
function Bar({
  className,
  tone = 'default',
}: {
  className: string
  tone?: 'default' | 'on-muted'
}) {
  const fill = tone === 'on-muted' ? 'bg-muted-foreground/15' : 'bg-muted'
  return <div className={cn('animate-pulse rounded-md', fill, className)} />
}

/** Satu baris teks palsu yang tingginya lahir dari line box aslinya. Ini satu-satunya cara kerangka ini berhenti bergeser saat data masuk. Menebak tinggi baris lewat `h-5` / `mt-0.5` sudah gagal sekali: `text-[11px]` dan `text-[22px]` tidak menyetel line-height, jadi angkanya bergantung pada font yang dimuat dan tidak bisa dihitung di kepala. Dengan menaruh contoh teks `invisible` di kelas teks YANG SAMA, tingginya dihitung peramban — dan ikut berubah sendiri kalau kelas teks komponen aslinya kelak diubah. `sample` tidak pernah terlihat dan tidak pernah dibacakan (`aria-hidden` ada di akar tiap kerangka), jadi isinya hanya perlu sepanjang teks yang diwakilinya. */
function Line({
  sample,
  className,
  bar,
  tone,
}: {
  sample: string
  className?: string
  bar: string
  tone?: 'default' | 'on-muted'
}) {
  return (
    <span className={cn('relative flex', className)}>
      <span className="invisible">{sample}</span>
      <Bar className={cn('absolute top-1/2 -translate-y-1/2', bar)} tone={tone} />
    </span>
  )
}

const ROW_TITLE_W = ['w-32', 'w-40', 'w-28', 'w-36', 'w-24'] as const

/** Baris `DataListRow`: penanda opsional, judul `text-[15px]` + meta `text-[13px]`, lalu kolom nilai yang RATA KANAN dan bertumpuk (`flex-col items-end gap-1`) — nominal di atas, bintang di bawahnya. Kolom itu dulu digambar sebagai satu bar tunggal, jadi tiap baris riwayat menyusut ~19px begitu bintangnya datang. */
function DataRowSkeleton({
  showDivider,
  titleWidth,
  marker,
  markerClass,
  stars,
}: {
  showDivider: boolean
  titleWidth: string
  marker?: boolean
  markerClass: string
  stars?: boolean
}) {
  return (
    <div
      className={cn(
        'bleed-x flex items-center gap-3 py-[var(--list-row-py)]',
        showDivider && 'border-b border-border/60',
      )}
    >
      {marker ? <Bar className={cn(markerClass, 'shrink-0 rounded-full')} /> : null}

      <div className="min-w-0 flex-1">
        <Line
          sample="Judul task riwayat"
          className="text-[15px] font-semibold tracking-tight"
          bar={cn('h-3.5', titleWidth)}
        />
        <Line
          sample="Sedang · 12 Mei 09.41"
          className="mt-0.5 text-[13px]"
          bar="h-3 w-24"
        />
      </div>

      {/* `StarRating` size sm: tiga ikon `size-3.5` dengan `gap-0.5` = 46px × 14px. */}
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Line sample="+120 credit" className="text-[15px] font-bold" bar="h-3.5 w-16" />
        {stars ? <Bar className="h-3.5 w-[2.875rem]" /> : null}
      </span>
    </div>
  )
}

/** Kerangka setinggi satu daftar, untuk panel yang memuat di dalam view yang sudah tergambar. `AppViewSkeleton` tidak bisa dipakai di sana: ia membawa hero band, tombol aksi, dan kartu task — seluruh anatomi Beranda — jadi saat dipasang di dalam tab ia menggambar layar yang berbeda dari yang sedang dibuka. */
export function DataListSkeleton({
  rows = 6,
  marker = false,
  markerClass = 'size-9',
  badge = false,
  action = false,
  stars = false,
}: {
  rows?: number
  marker?: boolean
  /** Diameter penanda baris. `DataList` biasa memakai lingkaran 36px, papan peringkat memakai avatar 40px (`BoardFrame`). */
  markerClass?: string
  /** `MetaBadge` di sisi kanan label. Sejak chip padat gaya fomo: teks 0.6875rem/1.25 + padding 0.1875rem ≈ 20px, radius `--chip-radius`. */
  badge?: boolean
  /** Tautan aksi di kepala daftar (mis. "Riwayat" di `RecentTransactions`). Ia berdiri SETELAH badge, sesuai urutan di `DataList`. */
  action?: boolean
  /** Kolom nilai bertumpuk dengan bintang di bawah nominal. */
  stars?: boolean
}) {
  return (
    <div className="animate-fade-in view-trim-b [--view-trim-b:var(--list-row-py)]" aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <Line
          sample="Transaksi terakhir"
          className="font-display text-[13px] font-bold tracking-tight"
          bar="h-3 w-36"
        />
        <span className="flex shrink-0 items-center gap-2">
          {badge ? <Bar className="h-5 w-20 rounded-[var(--chip-radius)]" /> : null}
          {action ? (
            <Line sample="Riwayat" className="text-[13px] font-semibold" bar="h-3 w-12" />
          ) : null}
        </span>
      </div>

      <div className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
        {Array.from({ length: rows }, (_, index) => (
          <DataRowSkeleton
            key={index}
            showDivider={index !== rows - 1}
            titleWidth={ROW_TITLE_W[index % ROW_TITLE_W.length]}
            marker={marker}
            markerClass={markerClass}
            stars={stars}
          />
        ))}
      </div>
    </div>
  )
}

/** Strip tab `SegmentedTabs`: tingginya mengikuti `--brand-pill-h`, sama seperti island di brand band. Tab pertama diberi permukaan terangkat karena `SegmentedTabs` selalu punya satu tab aktif — strip yang rata seluruhnya akan tersentak begitu data masuk. */
function PanelTabsSkeleton({
  labels,
  className,
}: {
  labels: readonly string[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-[var(--brand-pill-h)] gap-1 rounded-lg bg-track-surface p-0.5',
        className,
      )}
    >
      {labels.map((label, index) => (
        <div
          key={label}
          className={cn(
            'relative flex flex-1 items-center justify-center rounded-md px-3 text-[13px] font-bold tracking-tight',
            /* Bidang tab aktif mengikuti `SegmentedTabs`: senada `--muted`. Dulu `bg-card`, yang justru LEBIH GELAP dari wadahnya — arah elevasinya terbalik dari komponen yang akan menggantikan kerangka ini. */
            index === 0 && 'bg-muted',
          )}
        >
          <span className="invisible">{label}</span>
          {/* Nada bar ikut terbalik setelah warna di atas ditukar: bar tab aktif kini berdiri di atas `--muted`, bar tab lain di atas track yang lebih gelap. */}
          <Bar
            className="absolute h-3 w-10"
            tone={index === 0 ? 'on-muted' : 'default'}
          />
        </div>
      ))}
    </div>
  )
}

const MISSION_TITLE_W = ['w-36', 'w-44', 'w-28'] as const

/** Tiga baris, sebanyak `MISSIONS` di `domain/missions.ts`. Dipakai oleh `MissionCard` sendiri selagi `/api/missions` jalan, karena daftar itu memuat datanya di luar `/api/session` — jadi ia tetap kosong beberapa saat setelah kerangka app menghilang. Di view Misi permukaan `--muted`-nya dilepas, sama seperti `variant="page"` pada kartunya: kerangka harus menggambar bentuk yang benar-benar akan datang, bukan kotak yang tidak pernah muncul. */
export function MissionListSkeleton({ surface = true }: { surface?: boolean }) {
  const tone = surface ? 'on-muted' : 'default'

  return (
    <div aria-hidden className={cn('animate-fade-in', surface && SURFACE_CARD_CLASS)}>
      <div className="flex items-center justify-between gap-3">
        <Line
          sample="Misi hari ini"
          className="font-display text-[13px] font-bold tracking-tight"
          bar="h-3 w-24"
          tone={tone}
        />
        {/* Rasio "0/3" sekarang `MetaBadge` di `MissionCard`, jadi kerangkanya ikut menggambar bidang chip — teks redam setinggi 3px yang dulu di sini menyusut ~7px begitu chip 20px datang. Ukurannya sama dengan badge di `DataListSkeleton`, hanya lebih sempit karena isinya cuma rasio. */}
        <Bar className="h-5 w-9 shrink-0 rounded-[var(--chip-radius)]" tone={tone} />
      </div>

      <div className={cn('label-gap-t flex flex-col', surface ? 'gap-2.5' : 'gap-3')}>
        {MISSION_TITLE_W.map((titleWidth) => (
          <div key={titleWidth} className="flex h-7 items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <Bar className={cn('h-3.5 max-w-full', titleWidth)} tone={tone} />
            </div>
            <span className="meter-h w-14 shrink-0 rounded-full bg-muted-foreground/20" />
            <Bar className="h-3.5 w-[3.25rem] shrink-0" tone={tone} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AppViewSkeleton() {
  return (
    <div className="home-skin animate-fade-in view-min-h flex flex-col" aria-hidden>
      <div className="hero-band region-under-brand relative z-10">
        {/* Mengikuti `BalanceSummary`: nominal + ekor Rupiah di kiri, SATU tombol "Tarik dana" di kanan. Tombol ikon Riwayat yang dulu digambar di sini sudah pindah ke kepala daftar transaksi, dan judul "Saldo kamu" sudah dilepas — kerangka yang masih membawa keduanya menggeser seluruh hero saat data masuk. */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {/* `CreditAmount` size `display`: `heroFontSize()` memuncak di 3rem dengan line-height 1, jadi 48px pada lebar penuh. */}
            <Bar className="h-12 w-28" />
            <Line
              sample="Rp 1.234.567"
              className="stack-gap-t text-sm leading-none"
              bar="h-3.5 w-24"
            />
          </div>
          <Bar className="control-h w-28 shrink-0 rounded-cta" />
        </div>

        <div className="region-gap-t">
          {/* Dua bagian karcis, sama seperti `ActiveTask`: paddingnya sekarang ada di `.ticket-part`, bukan di `.task-card`. Kerangka yang masih memakai satu kotak akan tergambar tanpa bidang kartu sama sekali. */}
          <div className="task-card">
            <div className="ticket-part ticket-part-top">
              {/* `TaskHeading`: baris cetakan (nomor seri + lencana kesulitan) DI ATAS judul 22px. Judulnya dulu tidak digambar sama sekali, jadi kartunya tumbuh ~28px begitu task-nya datang dan mendorong tombol CTA. */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Line sample="KARCIS #A1B2C" className="home-tag" bar="h-2.5 w-24" />
                  <Bar className="h-5 w-16 shrink-0 rounded-[var(--chip-radius)]" />
                </div>
                <Line
                  sample="Judul task beranda"
                  className="stack-gap-t text-[22px] font-bold leading-tight tracking-[-0.02em]"
                  bar="h-4 w-44"
                />
              </div>

              {/* Perforasi karcis: garis nyata, bukan bar berdenyut — ia sudah tergambar penuh dan tidak sedang menunggu data apa pun. */}
              <div className="block-gap-t ticket-perf" />
            </div>

            <div className="ticket-part ticket-part-bottom">
              <div className="mt-3 grid grid-cols-3 gap-x-3">
                {[0, 1, 2].map((column) => (
                  <div className="stat-tile" key={column}>
                    <Line sample="MAKS" className="home-tag" bar="h-2.5 w-8" tone="on-muted" />
                    <Line
                      sample="+120"
                      className="mt-1 text-lg font-bold tracking-tight"
                      bar="h-4 w-12"
                      tone="on-muted"
                    />
                    <Line
                      sample="Rp 1.200"
                      className="text-[11px]"
                      bar="h-2.5 w-10"
                      tone="on-muted"
                    />
                  </div>
                ))}
              </div>

              {/* Dua tombol berdampingan, sesuai `ActiveTask`: "Mulai" selalu ada, tombol iklan hanya muncul kalau iklan menyala. Slot iklan disembunyikan lewat `data-ads-hint` yang dipasang script di `app/layout.tsx` dari tontonan terakhir user, bukan lewat state React — sesi belum termuat saat kerangka ini tergambar, dan membaca localStorage saat render akan membuat HTML server dan klien berbeda. */}
              <div className="cta-gap flex items-stretch gap-2 [&>*]:min-w-0 [&>*]:flex-1">
                <Bar className="cta-h rounded-cta" />
                <Bar className="skeleton-ad-slot cta-h rounded-cta" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Yang tersisa di bawah hero adalah "Transaksi terakhir" — tiga baris, sebanyak yang dipotong `RecentTransactions`, dengan badge jumlah task dan tautan "Riwayat" di kepalanya serta bintang di kolom nilai. Kartu premium dan bonus channel sengaja tidak digambar; keduanya bersyarat, dan kerangka yang menjanjikan kartu yang tidak datang menyentak lebih keras daripada kerangka yang kekurangan satu. */}
      <div className="region-t home-ledger flex flex-1 flex-col">
        <DataListSkeleton rows={3} badge action stars />
      </div>

      {/* Sama seperti `Home`: pengganjal biasa. Pemangkasan jarak ke nav sudah dibawa `DataListSkeleton` sendiri lewat `view-trim-b`. */}
      <div className="flex-1" />
    </div>
  )
}

/** `AppViewSkeleton` menggambar anatomi Beranda dan hanya boleh dipakai untuk Beranda. Peringkat, Statistik, dan Profil punya bentuk yang sama sekali lain — tidak ada hero saldo, tidak ada kartu task, tidak ada kartu misi. Memakai kerangka Beranda di sana lebih buruk daripada tidak memakai kerangka: ia menjanjikan tata letak yang tidak akan datang, lalu seluruh layar tersentak berganti begitu data masuk. Tiap view di bawah ini menggambar anatominya sendiri. */

const BOARD_SURFACE_LABEL = ['Papan', 'Aktivitas'] as const

/** Blok angka besar milik `TotalSummary` di Statistik: eyebrow 13px, angka `CreditAmount` size `2xl` — `text-5xl leading-none`, jadi tepat 48px — lalu satu baris ekor `text-sm leading-none`. */
function TotalSummarySkeleton({
  labelWidth,
  figureWidth,
  tailWidth,
}: {
  labelWidth: string
  figureWidth: string
  tailWidth: string
}) {
  return (
    <div className="region-under-brand">
      <Line
        sample="Total penghasilan"
        className="font-display text-[13px] font-bold tracking-tight"
        bar={cn('h-3', labelWidth)}
      />
      <Bar className={cn('label-gap-t h-12', figureWidth)} />
      <Line sample="Rp 1.234.567" className="stack-gap-t text-sm leading-none" bar={cn('h-3.5', tailWidth)} />
    </div>
  )
}

/** Kerangka Peringkat, mengikuti `LeaderboardView` apa adanya: strip tab → rail podium → kartu "Posisi kamu" → saringan + papan. Strip tabnya `PanelTabsSkeleton`, sama seperti Statistik dan Riwayat, karena baris Papan/Aktivitas di `LeaderboardView` kini `SegmentedTabs` berwadah `bg-track-surface` selebar layar. Dulu di sini `PlainTabsSkeleton` (pill setinggi teks, tanpa wadah): bentuk yang lebih pendek DAN lebih sempit dari yang datang, jadi seluruh isi halaman tersentak turun begitu papannya masuk. Bentuk yang lebih lama lagi juga sudah tidak ada di layar itu: tablist bergaris-bawah, hero angka besar (sekarang kartu baris), strip `solid` untuk saringan (sekarang satu chip dropdown), dan tanpa rail podium sama sekali. */
export function LeaderboardSkeleton() {
  return (
    <div className="animate-fade-in view-min-h flex flex-col" aria-hidden>
      <PanelTabsSkeleton labels={BOARD_SURFACE_LABEL} className="region-under-brand" />

      {/* Podium: baris label + tumpukan avatar, lalu tiga kartu `--rail-card-w`. `--label-trim` membayar balik `--rail-py`, persis seperti `PodiumRail`. */}
      <section className="region-under-brand">
        <div className="flex items-center justify-between gap-3">
          <Line
            sample="Podium"
            className="font-display text-[13px] font-bold tracking-tight"
            bar="h-3 w-16"
          />
          <span className="flex shrink-0 items-center">
            {[0, 1, 2].map((index) => (
              <Bar
                key={index}
                className={cn('size-6 rounded-full ring-2 ring-background', index > 0 && '-ml-2')}
              />
            ))}
          </span>
        </div>

        {/* Rail-nya dirangkai `CardRail` sendiri, bukan salinan `rail no-scrollbar bleed-x` — urutan ketiga kelas itu punya konsekuensi (lihat komentarnya di `card-rail.tsx`), dan kerangka yang menyalinnya akan diam-diam melenceng begitu rail aslinya disetel ulang. */}
        <CardRail
          ariaLabel="Memuat podium"
          className="label-gap-t [--label-trim:var(--rail-py)]"
        >
          {[0, 1, 2].map((index) => (
            <CardRailItem key={index}>
              <div className="task-card [--surface-p:0.75rem] flex h-full flex-col items-center gap-1.5 text-center">
                <Bar className="size-12 rounded-full" />
                <Line sample="Nama peserta" className="text-[13px] font-semibold" bar="h-3 w-20" />
                <Line sample="1.284" className="num-display text-[15px]" bar="h-4 w-16" />
                <Line sample="credit · 326 task" className="text-[11px]" bar="h-2.5 w-24" />
              </div>
            </CardRailItem>
          ))}
        </CardRail>
      </section>

      {/* "Posisi kamu": kartu berisi satu baris papan — bingkai avatar 40px, nama, meta, nominal di kanan. Dulu digambar sebagai hero angka raksasa. */}
      <section className="region-under-brand task-card">
        <Line
          sample="Posisi kamu"
          className="font-display text-[13px] font-bold tracking-tight"
          bar="h-3 w-24"
          tone="default"
        />
        <div className="label-gap-t flex items-center gap-3">
          <Bar className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            {/* Chip "Kamu" milik `MetaBadge` berdiri SEBARIS dengan nama, dan tingginya (≈20px) melebihi line box `text-[15px]` — baris yang digambar tanpa chip itu lahir beberapa piksel lebih pendek, lalu kartunya tersentak tumbuh begitu posisinya masuk. */}
            <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold tracking-tight">
              <Line sample="Nama kamu" bar="h-3.5 w-28" />
              <Bar className="h-5 w-12 shrink-0 rounded-[var(--chip-radius)]" />
            </span>
            <Line
              sample="#3 dari 1.284 peserta"
              className="mt-0.5 text-[13px]"
              bar="h-3 w-36"
            />
          </div>
          <Line sample="1.284 credit" className="shrink-0 text-[15px] font-bold" bar="h-3.5 w-16" />
        </div>
      </section>

      {/* Saringan papan kini satu `FilterChip` — pill `h-8` berkontur di kiri baris, bukan strip tab selebar layar. Chevron-nya ikut digambar sebagai ruang kosong, bukan diabaikan: pemicu `FilterChip` adalah `gap-1` + ikon `size-3.5`, jadi chip yang cuma selebar labelnya lahir ~18px lebih pendek dan pill-nya melar menyamping begitu papannya masuk. Bar-nya sendiri tetap hanya sepanjang label — yang sedang dimuat memang labelnya, bukan ikonnya. */}
      <div className="region-gap-t flex items-center justify-between gap-3">
        <div className="inline-flex h-8 items-center gap-1 rounded-full bg-card px-3 text-[13px] font-bold tracking-tight ring-1 ring-border ring-inset">
          <Line sample="Semua 1.284" bar="inset-x-0 h-3" />
          <span className="size-3.5 shrink-0" />
        </div>
      </div>

      {/* `BoardFrame` memakai avatar 40px, bukan lingkaran 36px milik `DataList` biasa, dan label daftarnya membawa `MetaBadge` jumlah peserta. */}
      <div className="region-t flex flex-1 flex-col">
        <DataListSkeleton rows={6} marker markerClass="size-10" badge />
      </div>

      {/* Sama seperti `BoardPanel`: daftar berakhir dengan baris, jadi sisa jarak ke nav dipangkas sebesar padding baris terakhir. */}
      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
    </div>
  )
}

const STATS_TAB_LABEL = ['Progres', 'Task', 'Saldo', 'Tarik'] as const
const STAT_ROW_LABEL_W = ['w-28', 'w-36', 'w-24', 'w-32', 'w-28'] as const

/** Baris `StatRow`: label dan nilai sejajar baseline dalam line box `text-sm`, dipisah divider dengan padding `--list-row-py` seperti `DataList`. */
function StatRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn(
            'bleed-x flex items-baseline justify-between gap-x-3 pt-[var(--list-row-py)]',
            index !== rows - 1 ? 'border-b border-border/60 pb-[var(--list-row-py)]' : 'pb-0',
          )}
        >
          <Line
            sample="Streak beraktivitas"
            className="min-w-0 text-sm"
            bar={cn('h-3', STAT_ROW_LABEL_W[index % STAT_ROW_LABEL_W.length])}
          />
          <Line
            sample="12 hari"
            className="shrink-0 text-sm font-semibold"
            bar="h-3 w-16"
          />
        </div>
      ))}
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="animate-fade-in view-min-h flex flex-col" aria-hidden>
      <TotalSummarySkeleton labelWidth="w-32" figureWidth="w-44" tailWidth="w-24" />

      <PanelTabsSkeleton labels={STATS_TAB_LABEL} className="region-gap-t" />

      <div className="region-t flex flex-1 flex-col">
        <Line
          sample="Progres"
          className="font-display text-[13px] font-bold tracking-tight"
          bar="h-3 w-24"
        />
        <StatRowsSkeleton rows={5} />
        <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
      </div>
    </div>
  )
}
