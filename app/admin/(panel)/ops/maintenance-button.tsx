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
    <section className="admin-card">
      <div>
        <h2 className="admin-eyebrow text-foreground">Pemeliharaan manual</h2>
        <p className="admin-sub">
          Jalankan tugas cron sekarang: bersihkan data kedaluwarsa, rekonsiliasi saldo, sapu sinyal fraud, dan kirim
          ajakan yang jatuh tempo.
        </p>
      </div>

      {error ? (
        <p role="alert" className="admin-note" data-tone="danger">
          {error}
        </p>
      ) : null}

      {summary ? (
        <>
          <p role="status" className="admin-note" data-tone="success">
            Selesai dalam {formatCredits(summary.durationMs)} ms
          </p>
          <div className="admin-stats">
            <Fact label="Selisih saldo" value={formatCredits(summary.balanceDrift)} urgent={summary.balanceDrift > 0} />
            <Fact label="Soal dihapus" value={formatCredits(summary.challenges)} />
            <Fact label="Sesi dihapus" value={formatCredits(summary.sessions)} />
            <Fact
              label="Pesan terkirim"
              value={formatCredits(Object.values(summary.notified ?? {}).reduce((sum, count) => sum + count, 0))}
            />
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="focus-ring transition-ui admin-btn admin-btn-quiet"
      >
        {pending ? 'Menjalankan…' : 'Jalankan pemeliharaan'}
      </button>
    </section>
  )
}

function Fact({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div className="admin-stat" data-urgent={urgent ? 'danger' : undefined}>
      <span className="admin-stat-k">{label}</span>
      <span className="admin-stat-v">{value}</span>
    </div>
  )
}
