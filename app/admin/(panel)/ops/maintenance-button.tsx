'use client'

import { useState } from 'react'
import { ApiError, sendJson } from '@/shell/api-client'
import { formatCredits } from '@/shared/lib/format'

type Summary = { durationMs: number; challenges: number; rateLimits: number; sessions: number; balanceDrift: number; notified: Record<string, number> }

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
    <section className="admin-panel flex flex-col gap-4 p-4 sm:p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alat sistem</p>
        <h2 className="pt-1 font-display text-base font-bold text-foreground">Pemeliharaan manual</h2>
        <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
          Jalankan tugas cron sekarang untuk membersihkan data kedaluwarsa, rekonsiliasi saldo, menyapu sinyal fraud, dan mengirim ajakan yang jatuh tempo.
        </p>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-destructive px-3 py-2.5 text-sm font-medium text-destructive">{error}</p> : null}

      {summary ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-xs font-semibold text-success">Pemeliharaan selesai dalam {formatCredits(summary.durationMs)} ms</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Fact label="Selisih saldo" value={formatCredits(summary.balanceDrift)} urgent={summary.balanceDrift > 0} />
            <Fact label="Soal dihapus" value={formatCredits(summary.challenges)} />
            <Fact label="Sesi dihapus" value={formatCredits(summary.sessions)} />
            <Fact label="Pesan terkirim" value={formatCredits(Object.values(summary.notified ?? {}).reduce((sum, count) => sum + count, 0))} />
          </dl>
        </div>
      ) : null}

      <button type="button" onClick={run} disabled={pending} className="focus-ring transition-ui self-start rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-background disabled:opacity-50">
        {pending ? 'Menjalankan pemeriksaan…' : 'Jalankan pemeliharaan'}
      </button>
    </section>
  )
}

function Fact({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return <div className="flex min-h-20 flex-col justify-center gap-1 rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={urgent ? 'font-display text-lg font-bold tabular-nums text-destructive' : 'font-display text-lg font-bold tabular-nums text-foreground'}>{value}</dd></div>
}
