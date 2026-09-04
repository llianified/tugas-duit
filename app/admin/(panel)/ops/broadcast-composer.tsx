'use client'

import { useState } from 'react'
import { BROADCAST_BODY_MAX, BROADCAST_SEGMENTS, type BroadcastSegment } from '@/domain/messaging/broadcast'
import { ApiError, sendJson } from '@/shell/api-client'
import { formatCredits } from '@/shared/lib/format'

type Stage = 'tulis' | 'konfirmasi' | 'kirim'
type RunResult = { id: string; sent: number; failed: number; remaining: number; done: boolean }

const STAGES: { id: Stage; label: string }[] = [
  { id: 'tulis', label: 'Tulis' },
  { id: 'konfirmasi', label: 'Periksa' },
  { id: 'kirim', label: 'Kirim' },
]

export function BroadcastComposer() {
  const [stage, setStage] = useState<Stage>('tulis')
  const [segment, setSegment] = useState<BroadcastSegment>('semua')
  const [body, setBody] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [recipients, setRecipients] = useState<number | null>(null)
  const [run, setRun] = useState<RunResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const text = body.trim()
  const valid = text.length > 0 && text.length <= BROADCAST_BODY_MAX
  const chosen = BROADCAST_SEGMENTS.find((entry) => entry.id === segment)

  function fail(cause: unknown) {
    setError(cause instanceof ApiError ? cause.message : 'Gagal. Coba lagi.')
  }

  async function preview() {
    setPending(true)
    setError(null)
    try {
      const result = await sendJson<{ recipients: number }>('/api/admin/broadcast', 'POST', { action: 'preview', segment })
      setRecipients(result.recipients)
      setStage('konfirmasi')
    } catch (cause) {
      fail(cause)
    } finally {
      setPending(false)
    }
  }

  async function send() {
    setPending(true)
    setError(null)
    try {
      const created = await sendJson<{ id: string }>('/api/admin/broadcast', 'POST', { action: 'create', segment, body: text })
      setStage('kirim')
      setRun(await sendJson<RunResult>('/api/admin/broadcast', 'POST', { action: 'send', broadcastId: created.id }))
    } catch (cause) {
      fail(cause)
    } finally {
      setPending(false)
    }
  }

  async function resume() {
    if (!run) return
    setPending(true)
    setError(null)
    try {
      const next = await sendJson<RunResult>('/api/admin/broadcast', 'POST', { action: 'send', broadcastId: run.id })
      setRun({ ...next, sent: run.sent + next.sent, failed: run.failed + next.failed })
    } catch (cause) {
      fail(cause)
    } finally {
      setPending(false)
    }
  }

  function reset() {
    setStage('tulis')
    setBody('')
    setConfirmText('')
    setRecipients(null)
    setRun(null)
    setError(null)
  }

  return (
    <section className="admin-panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-destructive">Aksi massal</p>
          <h2 className="pt-1 font-display text-lg font-bold text-foreground">Siaran ke pengguna</h2>
          <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
            Khusus pengumuman. Pengguna yang menekan /stop tidak disertakan dan kabar penarikan tidak dikirim dari alat ini.
          </p>
        </div>
        <ol className="flex shrink-0 items-center gap-1" aria-label="Tahap pengiriman">
          {STAGES.map((entry, index) => {
            const activeIndex = STAGES.findIndex((item) => item.id === stage)
            const current = entry.id === stage
            const passed = index < activeIndex
            return (
              <li key={entry.id} aria-current={current ? 'step' : undefined} className={current ? 'rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground' : passed ? 'rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground' : 'rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground'}>
                {index + 1}. {entry.label}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {error ? <p role="alert" className="rounded-lg border border-destructive px-3 py-2.5 text-sm font-medium text-destructive">{error}</p> : null}

        {stage === 'tulis' ? (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-foreground">Penerima</span>
                <select value={segment} onChange={(event) => setSegment(event.target.value as BroadcastSegment)} className="focus-ring rounded-lg border border-border bg-background px-3 py-2.5 text-foreground">
                  {BROADCAST_SEGMENTS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                </select>
                <span className="text-xs leading-relaxed text-muted-foreground">{chosen?.description}</span>
              </label>

              <label className="flex flex-col gap-1.5 text-sm lg:col-span-2">
                <span className="font-semibold text-foreground">Isi pesan</span>
                <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={BROADCAST_BODY_MAX} placeholder="Mulai hari ini stok reward terisi lebih cepat…" className="focus-ring rounded-lg border border-border bg-background px-3 py-2.5 text-foreground" />
                <span className="text-right text-xs tabular-nums text-muted-foreground">{formatCredits(text.length)}/{formatCredits(BROADCAST_BODY_MAX)} karakter · teks biasa</span>
              </label>
            </div>
            <button type="button" onClick={preview} disabled={pending || !valid} className="focus-ring transition-ui self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground">
              {pending ? 'Menghitung penerima…' : 'Periksa penerima'}
            </button>
          </>
        ) : null}

        {stage === 'konfirmasi' ? (
          <>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-foreground">Akan dikirim ke <span className="font-bold tabular-nums">{formatCredits(recipients ?? 0)} pengguna</span> di segmen “{chosen?.label}”. Setelah berjalan, pesan tidak dapat ditarik.</p>
              <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm leading-relaxed text-foreground">{text}</p>
            </div>
            <label className="flex max-w-sm flex-col gap-1.5 text-sm">
              <span className="font-semibold text-foreground">Ketik KIRIM untuk mengonfirmasi</span>
              <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="KIRIM" autoComplete="off" className="focus-ring rounded-lg border border-border bg-background px-3 py-2.5 text-foreground" />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={reset} disabled={pending} className="focus-ring transition-ui rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Kembali</button>
              <button type="button" onClick={send} disabled={pending || confirmText.trim() !== 'KIRIM' || (recipients ?? 0) === 0} className="focus-ring transition-ui rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50">
                {pending ? 'Mengirim…' : 'Kirim siaran sekarang'}
              </button>
            </div>
          </>
        ) : null}

        {stage === 'kirim' && run ? (
          <>
            <div className="rounded-lg bg-muted p-4">
              <p className="font-display text-xl font-bold tabular-nums text-foreground">{formatCredits(run.sent)} terkirim</p>
              <p className="pt-1 text-sm tabular-nums text-muted-foreground">{run.failed > 0 ? `${formatCredits(run.failed)} gagal · ` : ''}{run.done ? 'Semua penerima sudah diproses.' : `${formatCredits(run.remaining)} penerima belum diproses.`}</p>
            </div>
            {!run.done ? <p className="text-xs leading-relaxed text-muted-foreground">Satu putaran berhenti di batas waktu route. Lanjutkan sampai sisa nol; penerima yang sudah berhasil tidak akan dikirimi lagi.</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={reset} disabled={pending} className="focus-ring transition-ui rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Tulis siaran baru</button>
              {!run.done ? <button type="button" onClick={resume} disabled={pending} className="focus-ring transition-ui rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50">{pending ? 'Mengirim…' : 'Lanjutkan pengiriman'}</button> : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
