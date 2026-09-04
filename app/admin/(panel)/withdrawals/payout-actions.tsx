'use client'

import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { PAYOUT_PROOF_ACCEPT, WITHDRAWAL_REJECT_REASON_MAX } from '@/domain/economy/withdrawal'
import { ApiError, sendFormData, sendJson } from '@/shell/api-client'

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
      <ActionPanel title="Konfirmasi transfer" description={`Tandai ${amountLabel} ke ${accountLabel} untuk ${userName} sebagai terkirim.`}>
        <p className="rounded-lg border border-destructive px-3 py-2.5 text-xs leading-relaxed text-destructive">
          Lanjutkan hanya jika transfer sudah benar-benar berhasil. Status ini tidak dapat dibatalkan dari panel.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <ProofField file={proof} onChange={setProof} disabled={pending} />
          <NoteField value={note} onChange={setNote} disabled={pending} />
        </div>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Row>
          <GhostButton onClick={() => changeMode('idle')} disabled={pending}>Batal</GhostButton>
          <PrimaryButton onClick={() => submit('paid')} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Konfirmasi sudah terkirim'}
          </PrimaryButton>
        </Row>
      </ActionPanel>
    )
  }

  if (mode === 'reject') {
    const trimmed = reason.trim()
    return (
      <ActionPanel title="Tolak pengajuan" description={`Saldo ${userName} akan dikembalikan dan alasan dikirim lewat Telegram.`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-foreground">Alasan penolakan</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={WITHDRAWAL_REJECT_REASON_MAX}
              disabled={pending}
              placeholder="Contoh: nama pemilik rekening tidak cocok."
              className="focus-ring rounded-lg border border-border bg-background px-3 py-2.5 text-foreground disabled:opacity-50"
            />
            <span className="text-right text-xs tabular-nums text-muted-foreground">{reason.length}/{WITHDRAWAL_REJECT_REASON_MAX}</span>
          </label>
          <NoteField value={note} onChange={setNote} disabled={pending} />
        </div>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Row>
          <GhostButton onClick={() => changeMode('idle')} disabled={pending}>Batal</GhostButton>
          <DangerButton onClick={() => submit('rejected')} disabled={pending || !trimmed}>
            {pending ? 'Menyimpan…' : 'Tolak dan kembalikan saldo'}
          </DangerButton>
        </Row>
      </ActionPanel>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <p className="text-sm font-semibold text-foreground">Keputusan payout</p>
        <p className="pt-0.5 text-xs text-muted-foreground">Selesaikan setelah transfer, atau tolak dengan alasan yang jelas.</p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <GhostButton onClick={() => changeMode('reject')}>Tolak</GhostButton>
        <PrimaryButton onClick={() => changeMode('confirm-paid')}>Tandai terkirim</PrimaryButton>
      </div>
    </div>
  )
}

function ProofField({ file, onChange, disabled }: { file: File | null; onChange: (file: File | null) => void; disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={fieldId} className="font-semibold text-foreground">Bukti transfer <span className="font-normal text-muted-foreground">(opsional)</span></label>
      <p className="text-xs leading-relaxed text-muted-foreground">JPEG, PNG, atau WebP hingga 5 MB. Gambar dikirim ke chat pengguna.</p>
      <input
        id={fieldId}
        ref={inputRef}
        type="file"
        accept={PAYOUT_PROOF_ACCEPT}
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="focus-ring rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-semibold file:text-foreground disabled:opacity-50"
      />
      {file ? (
        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => { if (inputRef.current) inputRef.current.value = ''; onChange(null) }} disabled={disabled} className="focus-ring shrink-0 rounded font-medium text-destructive hover:underline disabled:opacity-50">
            Hapus
          </button>
        </span>
      ) : null}
    </div>
  )
}

function NoteField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-foreground">Catatan internal <span className="font-normal text-muted-foreground">(opsional)</span></span>
      <span className="text-xs leading-relaxed text-muted-foreground">Simpan nomor referensi atau konteks untuk admin lain.</span>
      <input type="text" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="focus-ring rounded-lg border border-border bg-background px-3 py-2.5 text-foreground disabled:opacity-50" />
    </label>
  )
}

function ActionPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border bg-muted p-4 sm:p-5">
      <div>
        <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
        <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="rounded-lg border border-destructive px-3 py-2.5 text-sm font-medium text-destructive">{children}</p>
}

const BUTTON_BASE = 'focus-ring transition-ui rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50'

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`${BUTTON_BASE} bg-primary text-primary-foreground hover:bg-primary-hover`}>{children}</button>
}

function DangerButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`${BUTTON_BASE} bg-destructive text-background hover:opacity-90`}>{children}</button>
}

function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`${BUTTON_BASE} border border-border text-muted-foreground hover:bg-card hover:text-foreground`}>{children}</button>
}
