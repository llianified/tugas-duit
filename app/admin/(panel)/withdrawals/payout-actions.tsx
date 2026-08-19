'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WITHDRAWAL_REJECT_REASON_MAX } from '@/features/withdraw/domain'
import { ApiError, sendJson } from '@/shell/api-client'

type Mode = 'idle' | 'confirm-paid' | 'reject'

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

  async function submit(action: 'paid' | 'rejected') {
    setPending(true)
    setError(null)
    try {
      await sendJson(`/api/admin/withdrawals/${id}`, 'PATCH', {
        action,
        reason: action === 'rejected' ? reason.trim() : undefined,
        note: note.trim() || undefined,
      })
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
      <Panel>
        <p className="text-sm text-foreground">
          Tandai <span className="font-medium">{amountLabel}</span> ke {accountLabel} (
          {userName}) sebagai terkirim?
        </p>
        <p className="text-sm text-muted-foreground">
          Pastikan transfernya sudah benar-benar dilakukan. Status ini tidak bisa dibatalkan —
          perbaikannya harus lewat penyesuaian ledger manual.
        </p>
        <NoteField value={note} onChange={setNote} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Row>
          <PrimaryButton onClick={() => submit('paid')} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Ya, sudah terkirim'}
          </PrimaryButton>
          <GhostButton onClick={() => setMode('idle')} disabled={pending}>
            Batal
          </GhostButton>
        </Row>
      </Panel>
    )
  }

  if (mode === 'reject') {
    const trimmed = reason.trim()

    return (
      <Panel>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Alasan penolakan</span>
          <span className="text-muted-foreground">
            Dikirim ke {userName} lewat Telegram. Saldo otomatis dikembalikan.
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={WITHDRAWAL_REJECT_REASON_MAX}
            placeholder="Nama pemilik rekening tidak cocok."
            className="rounded-md bg-muted px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {reason.length}/{WITHDRAWAL_REJECT_REASON_MAX}
          </span>
        </label>
        <NoteField value={note} onChange={setNote} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Row>
          <DangerButton onClick={() => submit('rejected')} disabled={pending || !trimmed}>
            {pending ? 'Menyimpan…' : 'Tolak pengajuan'}
          </DangerButton>
          <GhostButton onClick={() => setMode('idle')} disabled={pending}>
            Batal
          </GhostButton>
        </Row>
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Row>
        <PrimaryButton onClick={() => setMode('confirm-paid')}>Tandai terkirim</PrimaryButton>
        <GhostButton onClick={() => setMode('reject')}>Tolak</GhostButton>
      </Row>
    </div>
  )
}

function NoteField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-foreground">Catatan admin (opsional)</span>
      <span className="text-muted-foreground">Hanya untuk internal, mis. nomor referensi transfer.</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md bg-muted px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      />
    </label>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-md bg-card p-3">{children}</div>
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  )
}

const BUTTON_BASE =
  'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50'

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE} bg-primary text-primary-foreground hover:bg-[var(--color-primary-hover)]`}
    >
      {children}
    </button>
  )
}

function DangerButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE} bg-destructive text-primary-foreground hover:opacity-90`}
    >
      {children}
    </button>
  )
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE} text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground`}
    >
      {children}
    </button>
  )
}
