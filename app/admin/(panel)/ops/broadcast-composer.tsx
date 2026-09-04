'use client'

import { useState } from 'react'
import { BROADCAST_BODY_MAX, BROADCAST_SEGMENTS, type BroadcastSegment } from '@/domain/messaging/broadcast'
import { ApiError, sendJson } from '@/shell/api-client'
import { formatCredits } from '@/shared/lib/format'
import { GlyphChevron } from '@/shared/components/glyph'

type Stage = 'tulis' | 'konfirmasi' | 'kirim'
type RunResult = { id: string; sent: number; failed: number; remaining: number; done: boolean }

const STAGES: { id: Stage; label: string }[] = [
  { id: 'tulis', label: 'Tulis' },
  { id: 'konfirmasi', label: 'Periksa' },
  { id: 'kirim', label: 'Kirim' },
]

/** Siaran tetap tiga tahap meski layarnya sempit: menulis, memeriksa jumlah penerima, lalu mengirim. Tahapnya ditandai chip kecil di kop kartu, bukan stepper lebar, supaya isi pesan tetap mendapat hampir seluruh lebar ponsel. */
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
  const activeIndex = STAGES.findIndex((item) => item.id === stage)

  function fail(cause: unknown) {
    setError(cause instanceof ApiError ? cause.message : 'Gagal. Coba lagi.')
  }

  async function preview() {
    setPending(true)
    setError(null)
    try {
      const result = await sendJson<{ recipients: number }>('/api/admin/broadcast', 'POST', {
        action: 'preview',
        segment,
      })
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
      const created = await sendJson<{ id: string }>('/api/admin/broadcast', 'POST', {
        action: 'create',
        segment,
        body: text,
      })
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
    <section className="admin-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="admin-eyebrow text-foreground">Siaran ke pengguna</h2>
          <p className="admin-sub">
            Khusus pengumuman. Yang menekan /stop tidak disertakan, dan kabar penarikan tidak dikirim dari sini.
          </p>
        </div>
        <span className="chip chip-destructive shrink-0">
          {activeIndex + 1}/{STAGES.length} {STAGES[activeIndex].label}
        </span>
      </div>

      {error ? (
        <p role="alert" className="admin-note" data-tone="danger">
          {error}
        </p>
      ) : null}

      {stage === 'tulis' ? (
        <>
          <label className="admin-field">
            <span className="admin-field-k">Penerima</span>
            <span className="admin-select-wrap">
              <select
                value={segment}
                onChange={(event) => setSegment(event.target.value as BroadcastSegment)}
                className="focus-ring admin-input admin-select"
              >
                {BROADCAST_SEGMENTS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <GlyphChevron direction="down" className="admin-select-icon" />
            </span>
            <span className="admin-sub">{chosen?.description}</span>
          </label>

          <label className="admin-field">
            <span className="admin-field-k">Isi pesan</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              maxLength={BROADCAST_BODY_MAX}
              placeholder="Mulai hari ini stok reward terisi lebih cepat…"
              className="focus-ring admin-input"
            />
            <span className="admin-sub text-right tabular-nums">
              {formatCredits(text.length)}/{formatCredits(BROADCAST_BODY_MAX)} karakter · teks biasa
            </span>
          </label>

          <button
            type="button"
            onClick={preview}
            disabled={pending || !valid}
            className="focus-ring transition-ui admin-btn admin-btn-primary"
          >
            {pending ? 'Menghitung penerima…' : 'Periksa penerima'}
          </button>
        </>
      ) : null}

      {stage === 'konfirmasi' ? (
        <>
          <p className="admin-note" data-tone="danger">
            Akan dikirim ke <span className="font-bold tabular-nums">{formatCredits(recipients ?? 0)} pengguna</span> di
            segmen “{chosen?.label}”. Setelah berjalan, pesan tidak dapat ditarik.
          </p>
          <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs leading-relaxed text-foreground">{text}</p>
          <label className="admin-field">
            <span className="admin-field-k">Ketik KIRIM untuk mengonfirmasi</span>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="KIRIM"
              autoComplete="off"
              className="focus-ring admin-input"
            />
          </label>
          <div className="admin-actions">
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="focus-ring transition-ui admin-btn admin-btn-quiet"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={send}
              disabled={pending || confirmText.trim() !== 'KIRIM' || (recipients ?? 0) === 0}
              className="focus-ring transition-ui admin-btn admin-btn-danger admin-btn-grow"
            >
              {pending ? 'Mengirim…' : 'Kirim sekarang'}
            </button>
          </div>
        </>
      ) : null}

      {stage === 'kirim' && run ? (
        <>
          <div className="admin-stats">
            <div className="admin-stat">
              <span className="admin-stat-k">Terkirim</span>
              <span className="admin-stat-v">{formatCredits(run.sent)}</span>
            </div>
            <div className="admin-stat" data-urgent={run.failed > 0 ? 'danger' : undefined}>
              <span className="admin-stat-k">Gagal</span>
              <span className="admin-stat-v">{formatCredits(run.failed)}</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-k">Sisa</span>
              <span className="admin-stat-v">{formatCredits(run.remaining)}</span>
            </div>
          </div>
          {run.done ? (
            <p className="admin-note" data-tone="success">
              Semua penerima sudah diproses.
            </p>
          ) : (
            <p className="admin-note">
              Satu putaran berhenti di batas waktu route. Lanjutkan sampai sisa nol; penerima yang sudah berhasil tidak
              dikirimi lagi.
            </p>
          )}
          <div className="admin-actions">
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="focus-ring transition-ui admin-btn admin-btn-quiet admin-btn-grow"
            >
              Siaran baru
            </button>
            {!run.done ? (
              <button
                type="button"
                onClick={resume}
                disabled={pending}
                className="focus-ring transition-ui admin-btn admin-btn-primary admin-btn-grow"
              >
                {pending ? 'Mengirim…' : 'Lanjutkan'}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}
