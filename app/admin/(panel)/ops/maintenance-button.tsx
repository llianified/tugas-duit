'use client'

import { useState } from 'react'
import { ApiError, sendJson } from '@/shell/api-client'
import { formatCredits } from '@/shared/lib/format'

type Summary = {
  durationMs: number
  challenges: number
  rateLimits: number
  sessions: number
  balanceDrift: number
  notified: Record<string, number>
}

/** Menjalankan pemeliharaan sekarang, tanpa menunggu cron harian. Gunanya bukan mempercepat pembersihan — itu bisa menunggu — melainkan rekonsiliasi saldo dan sapuan sinyal fraud, dua hal yang ingin dilihat admin SEKARANG saat ada yang mencurigakan. Hasilnya ditampilkan apa adanya, termasuk selisih saldo, karena angka itu yang paling penting dan selama ini cuma muncul di log server. Ringkasannya dirender dari balasan route, bukan dengan menyegarkan halaman: halaman Operasi menjalankan empat query saat dirender, dan memuat ulang semuanya hanya untuk menampilkan enam angka membuat tab-nya berkedip tanpa alasan. */
export function MaintenanceButton() {
  const [pending, setPending] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setPending(true)
    setError(null)
    try {
      setSummary(await sendJson<Summary>('/api/admin/maintenance', 'POST'))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Gagal menjalankan pemeliharaan.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-muted p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Pemeliharaan manual</h3>
        <p className="text-sm text-muted-foreground">
          Isinya sama persis dengan cron harian: bersihkan data kedaluwarsa, rekonsiliasi
          saldo, sapu sinyal fraud, lalu kirim pesan ajakan yang jatuh temponya. Pesan ajakan
          hanya berangkat kalau sekarang di antara pukul 08.00–20.00 WIB.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {summary ? (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Fact label="Selisih saldo" value={formatCredits(summary.balanceDrift)} urgent={summary.balanceDrift > 0} />
          <Fact label="Soal dihapus" value={formatCredits(summary.challenges)} />
          <Fact label="Sesi dihapus" value={formatCredits(summary.sessions)} />
          <Fact
            label="Pesan terkirim"
            value={formatCredits(
              Object.values(summary.notified ?? {}).reduce((sum, count) => sum + count, 0),
            )}
          />
        </dl>
      ) : null}

      <div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="focus-ring rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Menjalankan…' : 'Jalankan sekarang'}
        </button>
      </div>
    </section>
  )
}

function Fact({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-base font-semibold tabular-nums ${urgent ? 'text-destructive' : 'text-foreground'}`}
      >
        {value}
      </dd>
    </div>
  )
}
