'use client'

import { SURFACE_CARD_CLASS } from '@/shared/components/surface-card'

/**
 * `tone="on-muted"` untuk bar yang berdiri di atas permukaan `--muted`.
 *
 * Bar default berwarna `--muted` supaya terlihat di atas latar view. Di dalam kartu
 * yang latarnya sendiri `--muted` (kartu misi, strip tab) bar itu lenyap — bukan
 * "kalem", tapi benar-benar tidak terlihat, sehingga kerangkanya menggambar kotak
 * kosong alih-alih baris yang sedang dimuat.
 */
function Bar({
  className,
  tone = 'default',
}: {
  className: string
  tone?: 'default' | 'on-muted'
}) {
  const fill = tone === 'on-muted' ? 'bg-muted-foreground/15' : 'bg-muted'
  return <div className={`animate-pulse rounded-md ${fill} ${className}`} />
}

const ROW_TITLE_W = ['w-32', 'w-40', 'w-28', 'w-36', 'w-24'] as const

function DataRowSkeleton({
  showDivider,
  titleWidth,
  marker,
  markerClass,
}: {
  showDivider: boolean
  titleWidth: string
  marker?: boolean
  markerClass: string
}) {
  return (
    <div
      className={[
        'bleed-x flex items-center gap-3 py-[var(--list-row-py)]',
        showDivider ? 'border-b border-border/60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {marker ? <Bar className={`${markerClass} shrink-0 rounded-full`} /> : null}

      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center">
          <Bar className={`h-3.5 ${titleWidth}`} />
        </div>
        <div className="mt-0.5 flex h-4 items-center">
          <Bar className="h-3 w-24" />
        </div>
      </div>
      <Bar className="h-3.5 w-16" />
    </div>
  )
}

/**
 * Kerangka setinggi satu daftar, untuk panel yang memuat di dalam view yang sudah
 * tergambar. `AppViewSkeleton` tidak bisa dipakai di sana: ia membawa hero band,
 * tombol aksi, dan kartu task — seluruh anatomi Beranda — jadi saat dipasang di dalam
 * tab ia menggambar layar yang berbeda dari yang sedang dibuka.
 */
export function DataListSkeleton({
  rows = 6,
  marker = false,
  markerClass = 'size-9',
  badge = false,
}: {
  rows?: number
  marker?: boolean
  /** Diameter penanda baris. `DataList` biasa memakai lingkaran 36px, papan
   *  peringkat memakai avatar 40px (`BoardFrame`). */
  markerClass?: string
  /** `MetaBadge` di sisi kanan label. Sejak chip padat gaya fomo: teks
   *  0.6875rem/1.25 + padding 0.1875rem ≈ 20px, radius `--chip-radius`. */
  badge?: boolean
}) {
  return (
    <div
      className="animate-fade-in view-trim-b [--view-trim-b:var(--list-row-py)]"
      aria-hidden
    >
      <div className="flex items-center justify-between gap-3">
        <Bar className="h-3 w-36" />
        {badge ? <Bar className="h-5 w-32 rounded-[var(--chip-radius)]" /> : null}
      </div>
      <div className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
        {Array.from({ length: rows }, (_, index) => (
          <DataRowSkeleton
            key={index}
            showDivider={index !== rows - 1}
            titleWidth={ROW_TITLE_W[index % ROW_TITLE_W.length]}
            marker={marker}
            markerClass={markerClass}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Strip tab digambar dengan label aslinya, dibuat tak terlihat.
 *
 * Tinggi satu tab lahir dari line box teksnya, bukan dari angka yang bisa ditebak,
 * jadi `<span className="invisible">` adalah satu-satunya cara strip ini berakhir
 * setinggi `SegmentedTabs` yang akan menggantikannya. Tab pertama diberi permukaan
 * terangkat karena `SegmentedTabs` selalu punya satu tab aktif — strip yang rata
 * seluruhnya akan tersentak begitu data masuk.
 */
function PanelTabsSkeleton({
  labels,
  className,
}: {
  labels: readonly string[]
  className?: string
}) {
  return (
    <div className={['flex gap-1 rounded-lg bg-muted p-1', className].filter(Boolean).join(' ')}>
      {labels.map((label, index) => (
        <div
          key={label}
          className={[
            'relative flex flex-1 items-center justify-center rounded-md px-3 py-2 text-[13px] font-bold tracking-tight',
            index === 0 ? 'bg-card shadow-sm' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="invisible">{label}</span>
          <Bar
            className="absolute h-3 w-10"
            tone={index === 0 ? 'default' : 'on-muted'}
          />
        </div>
      ))}
    </div>
  )
}

const MISSION_TITLE_W = ['w-36', 'w-44', 'w-28'] as const

/**
 * Tiga baris, sebanyak `MISSIONS` di `domain/missions.ts`.
 *
 * Dipakai oleh `MissionCard` sendiri selagi `/api/missions` jalan, karena daftar itu
 * memuat datanya di luar `/api/session` — jadi ia tetap kosong beberapa saat setelah
 * kerangka app menghilang. Di view Misi permukaan `--muted`-nya dilepas, sama seperti
 * `variant="page"` pada kartunya: kerangka harus menggambar bentuk yang benar-benar
 * akan datang, bukan kotak yang tidak pernah muncul.
 */
export function MissionListSkeleton({ surface = true }: { surface?: boolean }) {
  const tone = surface ? 'on-muted' : 'default'

  return (
    <div
      aria-hidden
      className={['animate-fade-in', surface ? SURFACE_CARD_CLASS : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-6 items-center">
          <Bar className="h-3 w-24" tone={tone} />
        </div>
        <Bar className="h-3 w-7 shrink-0" tone={tone} />
      </div>

      <div className={`label-gap-t flex flex-col ${surface ? 'gap-2.5' : 'gap-3'}`}>
        {MISSION_TITLE_W.map((titleWidth) => (
          <div key={titleWidth} className="flex h-7 items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <Bar className={`h-3.5 max-w-full ${titleWidth}`} tone={tone} />
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
    <div className="animate-fade-in view-min-h flex flex-col" aria-hidden>
      <div className="hero-band region-under-brand">
        <Bar className="h-12 w-44" />
        <Bar className="stack-gap-t h-3.5 w-24" />

        <div className="mt-[var(--region-gap)] flex gap-2">
          <Bar className="control-h flex-1 rounded-cta" />
          <Bar className="control-h flex-1 rounded-cta" />
        </div>

        <div className="region-gap-t">
          <div className="task-card">
            <div className="flex h-7 items-center justify-between gap-3">
              <Bar className="h-5 w-40" />
              <Bar className="h-6 w-20 rounded-md" />
            </div>
            <div className="block-gap-t grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((column) => (
                // Tinggi tiap baris disetel ke line box aslinya di `TaskStats`:
                // eyebrow 19,5px, angka text-lg 28px, catatan text-[11px] 16,5px.
                // Kalau ditebak, tombol CTA di bawahnya bergeser saat data masuk —
                // pergeseran yang paling terasa justru karena itu tombolnya.
                <div className="stat-tile" key={column}>
                  <div className="flex h-5 items-center">
                    <Bar className="h-2.5 w-10" tone="on-muted" />
                  </div>
                  <div className="mt-0.5 flex h-7 items-center">
                    <Bar className="h-4 w-12" tone="on-muted" />
                  </div>
                  <div className="flex h-4 items-center">
                    <Bar className="h-2.5 w-10" tone="on-muted" />
                  </div>
                </div>
              ))}
            </div>

            {/*
              Dua tombol berdampingan, sesuai `ActiveTask`: "Mulai" selalu ada, tombol
              iklan hanya muncul kalau iklan menyala. Slot iklan disembunyikan lewat
              `data-ads-hint` yang dipasang script di `app/layout.tsx` dari tontonan
              terakhir user, bukan lewat state React — sesi belum termuat saat kerangka
              ini tergambar, dan membaca localStorage saat render akan membuat HTML
              server dan klien berbeda.
            */}
            <div className="cta-gap flex gap-2">
              <Bar className="cta-h min-w-0 flex-1 rounded-cta" />
              <Bar className="skeleton-ad-slot cta-h min-w-0 flex-1 rounded-cta" />
            </div>
          </div>
        </div>
      </div>

      {/*
        Strip tab dan kartu misi dilepas bersama tab Beranda: sejak Misi pindah ke nav,
        yang tersisa di bawah hero adalah "Transaksi terakhir" — tiga baris, sebanyak
        yang dipotong `RecentTransactions`. Kartu premium dan bonus channel sengaja
        tidak digambar; keduanya bersyarat, dan kerangka yang menjanjikan kartu yang
        tidak datang menyentak lebih keras daripada kerangka yang kekurangan satu.
      */}
      <div className="region-t flex flex-1 flex-col">
        <DataListSkeleton rows={3} badge />
      </div>

      {/* Sama seperti `RecentTransactions`: region ditutup baris list, jadi sisa jarak
          ke nav dipangkas sebesar padding baris terakhir. */}
      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
    </div>
  )
}

/**
 * `AppViewSkeleton` menggambar anatomi Beranda dan hanya boleh dipakai untuk Beranda.
 *
 * Peringkat, Statistik, dan Profil punya bentuk yang sama sekali lain — tidak ada hero
 * saldo, tidak ada kartu task, tidak ada kartu misi. Memakai kerangka Beranda di sana
 * lebih buruk daripada tidak memakai kerangka: ia menjanjikan tata letak yang tidak
 * akan datang, lalu seluruh layar tersentak berganti begitu data masuk. Tiap view di
 * bawah ini menggambar anatominya sendiri.
 */

const BOARD_SURFACE_LABEL = ['Papan', 'Aktivitas'] as const
const BOARD_FILTER_LABEL = ['Semua', 'VIP'] as const

/**
 * Strip tab bergaris bawah milik Peringkat — bukan `SegmentedTabs`, jadi bentuknya
 * beda dari `PanelTabsSkeleton`: teks 15px dengan `border-b-2` dan `pb-2.5`. Sama
 * seperti strip yang lain, tingginya lahir dari line box label aslinya.
 */
function BoardSurfaceTabsSkeleton() {
  return (
    <div className="region-under-brand flex gap-5">
      {BOARD_SURFACE_LABEL.map((label, index) => (
        <div
          key={label}
          className={[
            'border-b-2 px-1 pb-2.5',
            index === 0 ? 'border-primary' : 'border-transparent',
          ].join(' ')}
        >
          <span className="relative flex text-[15px] font-bold tracking-tight">
            <span className="invisible">{label}</span>
            <Bar className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2" />
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Blok angka besar yang dipakai Peringkat ("Posisi kamu") dan Statistik ("Total
 * penghasilan"): eyebrow 13px, angka `CreditAmount` size 2xl — `text-5xl leading-none`,
 * jadi tepat 48px — lalu satu baris ekor `text-sm leading-none`.
 */
function HeroFigureSkeleton({
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
      <Bar className={`h-3 ${labelWidth}`} />
      <Bar className={`label-gap-t h-12 ${figureWidth}`} />
      <Bar className={`stack-gap-t h-3.5 ${tailWidth}`} />
    </div>
  )
}

export function LeaderboardSkeleton() {
  return (
    <div className="animate-fade-in view-min-h flex flex-col" aria-hidden>
      <BoardSurfaceTabsSkeleton />

      <HeroFigureSkeleton labelWidth="w-20" figureWidth="w-40" tailWidth="w-36" />

      <PanelTabsSkeleton labels={BOARD_FILTER_LABEL} className="region-gap-t" />

      {/* `BoardFrame` memakai avatar 40px, bukan lingkaran 36px milik `DataList`
          biasa, dan label daftarnya membawa `MetaBadge` jumlah peserta. */}
      <div className="region-t flex flex-1 flex-col">
        <DataListSkeleton rows={6} marker markerClass="size-10" badge />
      </div>

      {/* Sama seperti `BoardPanel`: daftar berakhir dengan baris, jadi sisa jarak ke nav
          dipangkas sebesar padding baris terakhir. */}
      <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
    </div>
  )
}

const STATS_TAB_LABEL = ['Progres', 'Task', 'Saldo', 'Tarik'] as const
const STAT_ROW_LABEL_W = ['w-28', 'w-36', 'w-24', 'w-32', 'w-28'] as const

/**
 * Baris `StatRow`: label dan nilai sejajar baseline dalam line box `text-sm` (20px),
 * dipisah divider dengan padding `--list-row-py` seperti `DataList`.
 */
function StatRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={[
            'flex items-center justify-between gap-3 pt-[var(--list-row-py)]',
            index !== rows - 1
              ? 'border-b border-border/60 pb-[var(--list-row-py)]'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="flex h-5 items-center">
            <Bar className={`h-3 ${STAT_ROW_LABEL_W[index % STAT_ROW_LABEL_W.length]}`} />
          </div>
          <div className="flex h-5 items-center">
            <Bar className="h-3 w-16 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="animate-fade-in view-min-h flex flex-col" aria-hidden>
      <HeroFigureSkeleton labelWidth="w-32" figureWidth="w-44" tailWidth="w-24" />

      <PanelTabsSkeleton labels={STATS_TAB_LABEL} className="region-gap-t" />

      <div className="region-t flex flex-1 flex-col">
        <Bar className="h-3 w-24" />
        <StatRowsSkeleton rows={5} />
        <div className="view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]" />
      </div>
    </div>
  )
}
