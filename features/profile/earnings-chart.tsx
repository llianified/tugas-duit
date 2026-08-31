'use client'

import { useId, useMemo } from 'react'
import type { EarningsPoint } from '@/features/stats/domain'

const WIDTH = 320
const HEIGHT = 96

/**
 * Grafik ditulis sebagai SVG langsung, tanpa pustaka bagan. Satu deret, tanpa sumbu,
 * tanpa interaksi — memuat pustaka bagan untuk itu menambah puluhan kilobyte ke
 * Mini App yang dibuka lewat jaringan seluler, dan tidak menggambar satu piksel pun
 * yang tidak bisa digambar `<path>`.
 *
 * `viewBox` tetap 320x96 sementara elemennya melar penuh: kurvanya diskalakan browser,
 * jadi tidak ada perhitungan ulang saat lebar layar berubah.
 */
export function EarningsChart({ series }: { series: EarningsPoint[] }) {
  const gradientId = useId()

  const shape = useMemo(() => {
    if (series.length === 0) return null

    const values = series.map((point) => point.credits)
    const max = Math.max(...values, 1)
    const step = series.length === 1 ? 0 : WIDTH / (series.length - 1)

    const points = values.map((value, index) => {
      const x = series.length === 1 ? WIDTH / 2 : index * step
      const y = HEIGHT - (value / max) * (HEIGHT - 8) - 4
      return { x, y }
    })

    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' ')
    const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`
    const last = points[points.length - 1]

    return { line, area, last }
  }, [series])

  if (!shape) {
    return (
      <div className="flex h-24 items-center justify-center text-[13px] text-muted-foreground">
        Grafik muncul setelah task pertama kamu selesai.
      </div>
    )
  }

  return (
    <svg
      role="img"
      aria-label="Grafik perolehan credit 30 hari terakhir"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-24 w-full overflow-visible"
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
      <circle
        cx={shape.last.x}
        cy={shape.last.y}
        r="4"
        fill="var(--success)"
        stroke="var(--background)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
