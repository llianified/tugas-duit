'use client'

import { useRouter } from 'next/navigation'
import { useId, useRef, useState, type ReactNode } from 'react'
import { PAYOUT_PROOF_ACCEPT, WITHDRAWAL_REJECT_REASON_MAX } from '@/domain/economy/withdrawal'
import { ApiError, sendFormData, sendJson } from '@/shell/api-client'

type Mode = 'idle' | 'confirm-paid' | 'reject'

/** Keputusan payout dibuka langsung di dalam kartu antrean, bukan di dialog: di layar ponsel admin perlu tetap melihat nominal dan rekening yang sedang ia putuskan sambil mengetik alasan atau melampirkan bukti. */
export function PayoutActions({
  id,
  userName,
  amountLabel,
  accountLabel,
}: {
  id: string
  userName: string
  amountLabel: string
  accountLabel: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proof, setProof] = useState<File | null>(null)

  function changeMode(next: Mode) {
    setError(null)
    setMode(next)
  }

  async function submit(action: 'paid' | 'rejected') {
    setPending(true)
    setError(null)
    try {
      if (action === 'paid' && proof) {
        const form = new FormData()
        form.set('action', 'paid')
        if (note.trim()) form.set('note', note.trim())
        form.set('proof', proof)
        await sendFormData(`/api/admin/withdrawals/${id}`, 'PATCH', form)
      } else {
        await sendJson(`/api/admin/withdrawals/${id}`, 'PATCH', {
          action,
          reason: action === 'rejected' ? reason.trim() : undefined,
          note: note.trim() || undefined,
        })
      }
      router.refresh()
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message)
        if (cause.status === 409) router.refresh()
      } else {
        setError('Gagal menyimpan keputusan. Coba lagi.')
      }
      setPending(false)
    }
  }

  if (mode === 'confirm-paid') {
    return (
      <div className="flex flex-col gap-2.5 border-t border-border pt-2.5">
        <p className="admin-note" data-tone="danger">
          Tandai {amountLabel} ke {accountLabel} sebagai terkirim. Lanjutkan hanya jika transfer benar-benar berhasil —
          status ini tidak bisa dibatalkan.
        </p>
        <ProofField file={proof} onChange={setProof} disabled={pending} />
        <NoteField value={note} onChange={setNote} disabled={pending} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <div className="admin-actions">
          <button
            type="button"
            onClick={() => changeMode('idle')}
            disabled={pending}
            className="focus-ring transition-ui admin-btn admin-btn-quiet"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => submit('paid')}
            disabled={pending}
            className="focus-ring transition-ui admin-btn admin-btn-primary admin-btn-grow"
          >
            {pending ? 'Menyimpan…' : 'Sudah terkirim'}
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'reject') {
    const trimmed = reason.trim()
    return (
      <div className="flex flex-col gap-2.5 border-t border-border pt-2.5">
        <p className="admin-note">Saldo {userName} dikembalikan dan alasan di bawah dikirim lewat Telegram.</p>
        <label className="admin-field">
          <span className="admin-field-k">Alasan penolakan</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={WITHDRAWAL_REJECT_REASON_MAX}
            disabled={pending}
            placeholder="Contoh: nama pemilik rekening tidak cocok."
            className="focus-ring admin-input"
          />
          <span className="admin-sub text-right tabular-nums">
            {reason.length}/{WITHDRAWAL_REJECT_REASON_MAX}
          </span>
        </label>
        <NoteField value={note} onChange={setNote} disabled={pending} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <div className="admin-actions">
          <button
            type="button"
            onClick={() => changeMode('idle')}
            disabled={pending}
            className="focus-ring transition-ui admin-btn admin-btn-quiet"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => submit('rejected')}
            disabled={pending || !trimmed}
            className="focus-ring transition-ui admin-btn admin-btn-danger admin-btn-grow"
          >
            {pending ? 'Menyimpan…' : 'Tolak dan kembalikan'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-actions border-t border-border pt-2.5">
      <button
        type="button"
        onClick={() => changeMode('reject')}
        className="focus-ring transition-ui admin-btn admin-btn-quiet admin-btn-grow"
      >
        Tolak
      </button>
      <button
        type="button"
        onClick={() => changeMode('confirm-paid')}
        className="focus-ring transition-ui admin-btn admin-btn-primary admin-btn-grow"
      >
        Tandai terkirim
      </button>
    </div>
  )
}

function ProofField({
  file,
  onChange,
  disabled,
}: {
  file: File | null
  onChange: (file: File | null) => void
  disabled: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()

  return (
    <div className="admin-field">
      <label htmlFor={fieldId} className="admin-field-k">
        Bukti transfer <span className="font-normal text-muted-foreground">opsional · dikirim ke chat user</span>
      </label>
      <input
        id={fieldId}
        ref={inputRef}
        type="file"
        accept={PAYOUT_PROOF_ACCEPT}
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="focus-ring admin-input file:mr-2.5 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-bold file:text-foreground"
      />
      {file ? (
        <span className="flex items-center justify-between gap-2">
          <span className="admin-sub truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = ''
              onChange(null)
            }}
            disabled={disabled}
            className="focus-ring shrink-0 rounded text-xs font-bold text-destructive"
          >
            Hapus
          </button>
        </span>
      ) : null}
    </div>
  )
}

function NoteField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <label className="admin-field">
      <span className="admin-field-k">
        Catatan internal <span className="font-normal text-muted-foreground">opsional</span>
      </span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder="Nomor referensi transfer"
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring admin-input"
      />
    </label>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="admin-note" data-tone="danger">
      {children}
    </p>
  )
}
