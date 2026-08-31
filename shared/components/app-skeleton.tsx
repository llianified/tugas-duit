'use client'

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
}: {
  showDivider: boolean
  titleWidth: string
  marker?: boolean
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
      {marker ? <Bar className="size-9 shrink-0 rounded-full" /> : null}

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
}: {
  rows?: number
  marker?: boolean
}) {
  return (
    <div
      className="animate-fade-in view-trim-b [--view-trim-b:var(--list-row-py)]"
      aria-hidden
    >
      <Bar className="h-3 w-36" />
      <div className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
        {Array.from({ length: rows }, (_, index) => (
          <DataRowSkeleton
            key={index}
            showDivider={index !== rows - 1}
            titleWidth={ROW_TITLE_W[index % ROW_TITLE_W.length]}
            marker={marker}
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
const PANEL_TAB_LABEL = ['Misi', 'Aktivitas'] as const

function PanelTabsSkeleton() {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {PANEL_TAB_LABEL.map((label, index) => (
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
 * Tiga baris, sebanyak `MISSIONS` di `domain/missions.ts`. Kartu misi adalah panel
 * bawaan Beranda, jadi bentuk inilah yang menggantikan kerangka ini — bukan daftar
 * transaksi, yang sekarang hidup di tab sebelahnya.
 */
function MissionCardSkeleton() {
  return (
    <div className="rounded-lg bg-muted/60 p-[var(--surface-p)] ring-border">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-6 items-center">
          <Bar className="h-3 w-24" tone="on-muted" />
        </div>
        <Bar className="h-6 w-24 rounded-md" tone="on-muted" />
      </div>

      <div className="label-gap-t flex flex-col gap-3">
        {MISSION_TITLE_W.map((titleWidth) => (
          <div key={titleWidth}>
            <div className="flex h-5 items-center justify-between gap-3">
              <Bar className={`h-3.5 ${titleWidth}`} tone="on-muted" />
              <Bar className="h-3.5 w-10 shrink-0" tone="on-muted" />
            </div>
            <div className="mt-1.5 flex h-4 items-center gap-2">
              <span className="h-1 min-w-0 flex-1 rounded-full bg-muted-foreground/20" />
              <Bar className="h-2.5 w-8 shrink-0" tone="on-muted" />
            </div>
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

      <div className="region-t">
        <PanelTabsSkeleton />
        <div className="region-gap-t">
          <MissionCardSkeleton />
        </div>
      </div>

      {/* Sama seperti `HomeView`: panel berakhir dengan kartu, bukan baris list, jadi
          sisa jarak ke nav dibiarkan penuh satu region-gap. */}
      <div className="flex-1" />
    </div>
  )
}
