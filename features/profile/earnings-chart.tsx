'use client'

import { useId, useMemo } from 'react'
import type { EarningsPoint } from '@/domain/progression/stats'

const WIDTH = 320
const HEIGHT = 96
/** Kurvanya berhenti sedikit sebelum tepi kanan. Titik hari terakhir duduk persis di ujung deret, jadi kalau deretnya sampai `WIDTH` separuh titiknya menggantung ke luar kolom — SVG-nya `overflow-visible`, tidak ada yang memotongnya. */
const PLOT_W = WIDTH - 8

/** Grafik ditulis sebagai SVG langsung, tanpa pustaka bagan. Satu deret, tanpa sumbu, tanpa interaksi — memuat pustaka bagan untuk itu menambah puluhan kilobyte ke Mini App yang dibuka lewat jaringan seluler, dan tidak menggambar satu piksel pun yang tidak bisa digambar `<path>`. `viewBox` tetap 320x96 sementara elemennya melar penuh: kurvanya diskalakan browser, jadi tidak ada perhitungan ulang saat lebar layar berubah. */
export function EarningsChart({ series }: { series: EarningsPoint[] }) {
  const gradientId = useId()

  /** Deretnya sekarang selalu memuat setiap hari dalam rentangnya, termasuk yang nol (`server/stats.ts`), jadi "kosong" tidak lagi berarti `length === 0` melainkan tidak ada satu pun credit di periode itu. Garis datar di nol bukan informasi, cuma bentuk. */
  const shape = useMemo(() => {
    const values = series.map((point) => point.credits)
    if (values.length === 0 || values.every((value) => value === 0)) return null

    const max = Math.max(...values, 1)
    const step = series.length === 1 ? 0 : PLOT_W / (series.length - 1)

    const points = values.map((value, index) => {
      const x = series.length === 1 ? PLOT_W / 2 : index * step
      const y = HEIGHT - (value / max) * (HEIGHT - 8) - 4
      return { x, y }
    })

    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' ')
    const area = `${line} L${PLOT_W},${HEIGHT} L0,${HEIGHT} Z`
    const last = points[points.length - 1]

    return { line, area, last }
  }, [series])

  if (!shape) {
    return (
      <div className="flex h-24 items-center justify-center text-[13px] text-muted-foreground">
        Belum ada credit yang masuk di periode ini.
      </div>
    )
  }

  return (
    /* Titik hari terakhir digambar sebagai elemen HTML di atas SVG-nya, bukan `<circle>` di dalamnya. Sebabnya `preserveAspectRatio="none"`: viewBox 320 direntang ke lebar kolom (~352px), jadi lingkaran apa pun di dalam SVG ikut melar jadi elips — `vectorEffect` cuma menjaga tebal garisnya, bukan bentuknya. Di luar SVG, titiknya bulat berapa pun lebar layarnya, dan letaknya tetap ikut kurva karena dinyatakan dalam persen dari kotak yang sama. */
    <div className="relative h-24">
      <svg
        role="img"
        aria-label="Grafik perolehan credit 30 hari terakhir"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={shape.area} fill={`url(#${gradientId})`} />
        <path
          d={shape.line}
          fill="none"
          stroke="var(--success)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <span
        aria-hidden="true"
        style={{
          left: `${(shape.last.x / WIDTH) * 100}%`,
          top: `${(shape.last.y / HEIGHT) * 100}%`,
        }}
        className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success ring-2 ring-background"
      />
    </div>
  )
}
