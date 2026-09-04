'use client'

import { useState } from 'react'
import {
  BROADCAST_BODY_MAX,
  BROADCAST_SEGMENTS,
  type BroadcastSegment,
} from '@/domain/messaging/broadcast'
import { ApiError, sendJson } from '@/shell/api-client'
import { formatCredits } from '@/shared/lib/format'

type Stage = 'tulis' | 'konfirmasi' | 'kirim'

type RunResult = { id: string; sent: number; failed: number; remaining: number; done: boolean }

/** Siaran ditulis di sini, tapi tidak pernah berangkat dalam satu ketukan. Alurnya sengaja tiga langkah: tulis, lihat berapa orang yang akan menerimanya, lalu ketik ulang kata "KIRIM" untuk menjalankan. Ini satu-satunya aksi di panel yang tidak bisa dibatalkan setelah jalan — bot yang dilaporkan spam bisa dibekukan Telegram, dan bot yang beku ikut mematikan notifikasi penarikan. Pengiriman jalan per putaran karena route punya batas waktu. Menekan "Lanjutkan kirim" MELANJUTKAN dari yang belum menerima, bukan mengulang dari awal — penandanya di `bot_notifications` yang menjamin itu. TIDAK ada `router.refresh()` di sini, dan itu disengaja. Halaman Operasi adalah komponen server yang menjalankan empat query saat dirender, jadi menyegarkannya di tengah pengiriman membuat seluruh tab memuat ulang tepat ketika admin sedang menunggu hitungan berjalan. Angka yang hidup sudah datang dari balasan tiap putaran; daftar "Siaran terakhir" di bawah cukup menyusul saat halamannya dibuka lagi. */
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
      setRun(await sendJson<RunResult>('/api/admin/broadcast', 'POST', {
        action: 'send',
        broadcastId: created.id,
      }))
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
      const next = await sendJson<RunResult>('/api/admin/broadcast', 'POST', {
        action: 'send',
        broadcastId: run.id,
      })
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
    <section className="flex flex-col gap-3 rounded-lg bg-muted p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Siaran ke user</h3>
        <p className="text-sm text-muted-foreground">
          User yang menekan /stop tidak pernah termasuk, apa pun segmennya. Kabar penarikan
          tidak lewat sini — ini khusus pengumuman.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {stage === 'tulis' ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Kirim ke</span>
            <select
              value={segment}
              onChange={(event) => setSegment(event.target.value as BroadcastSegment)}
              className="focus-ring rounded-md bg-background px-3 py-2 text-foreground"
            >
              {BROADCAST_SEGMENTS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">{chosen?.description}</span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Isi pesan</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              maxLength={BROADCAST_BODY_MAX}
              placeholder="Mulai hari ini stok reward terisi lebih cepat…"
              className="focus-ring rounded-md bg-background px-3 py-2 text-foreground"
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatCredits(text.length)}/{formatCredits(BROADCAST_BODY_MAX)} · dikirim sebagai
              teks biasa, tanpa HTML
            </span>
          </label>

          <div>
            <button
              type="button"
              onClick={preview}
              disabled={pending || !valid}
              className="focus-ring rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? 'Menghitung…' : 'Lihat jumlah penerima'}
            </button>
          </div>
        </>
      ) : null}

      {stage === 'konfirmasi' ? (
        <>
          <p className="text-sm text-foreground">
            Pesan ini akan dikirim ke{' '}
            <span className="font-semibold tabular-nums">
              {formatCredits(recipients ?? 0)} user
            </span>{' '}
            di segmen &ldquo;{chosen?.label}&rdquo;. Setelah jalan, pesannya tidak bisa ditarik.
          </p>
          <p className="whitespace-pre-wrap rounded-md bg-card px-3 py-2 text-sm text-foreground">
            {text}
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">
              Ketik KIRIM untuk menjalankan
            </span>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="KIRIM"
              className="focus-ring rounded-md bg-background px-3 py-2 text-foreground"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending || confirmText.trim() !== 'KIRIM' || (recipients ?? 0) === 0}
              className="focus-ring rounded-md bg-destructive px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? 'Mengirim…' : 'Kirim sekarang'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="focus-ring rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Batal
            </button>
          </div>
        </>
      ) : null}

      {stage === 'kirim' && run ? (
        <>
          <p className="text-sm tabular-nums text-foreground">
            {formatCredits(run.sent)} terkirim
            {run.failed > 0 ? `, ${formatCredits(run.failed)} gagal` : ''}.{' '}
            {run.done
              ? 'Semua penerima sudah dapat.'
              : `${formatCredits(run.remaining)} lagi belum menerima.`}
          </p>
          {run.done ? null : (
            <p className="text-xs text-muted-foreground">
              Satu putaran berhenti di batas waktu route, bukan karena ada yang gagal.
              Lanjutkan sampai sisanya nol — yang sudah menerima tidak akan dikirimi lagi.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {run.done ? null : (
              <button
                type="button"
                onClick={resume}
                disabled={pending}
                className="focus-ring rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {pending ? 'Mengirim…' : 'Lanjutkan kirim'}
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="focus-ring rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Tulis siaran baru
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}
