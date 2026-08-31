'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ApiError, sendJson } from '@/shell/api-client'
import { formatCredits } from '@/shared/lib/format'
import { Surface } from '@/shared/components/surface'
import { SectionLabel } from '@/shared/components/section-label'
import { ActionButton } from '@/shared/components/action-button'
import { TextInput } from '@/shared/components/input'

export function UserActions({
  publicId,
  firstName,
  username,
  isSuspended,
  isAdminFlag,
  isAdminByEnv,
  isSelf,
  balanceCredits,
  maxAdjust,
}: {
  publicId: string
  firstName: string
  username: string | null
  isSuspended: boolean
  isAdminFlag: boolean
  isAdminByEnv: boolean
  isSelf: boolean
  balanceCredits: number
  maxAdjust: number
}) {
  return (
    <div className="flex flex-col gap-4">
      <SectionLabel as="h3">Aksi admin</SectionLabel>
      <AdjustBalance publicId={publicId} balanceCredits={balanceCredits} maxAdjust={maxAdjust} />
      <Suspension publicId={publicId} firstName={firstName} isSuspended={isSuspended} isSelf={isSelf} />
      <AdminFlag
        publicId={publicId}
        firstName={firstName}
        isAdminFlag={isAdminFlag}
        isAdminByEnv={isAdminByEnv}
        isSelf={isSelf}
      />
      <Profile publicId={publicId} firstName={firstName} username={username} />
    </div>
  )
}

function AdjustBalance({
  publicId,
  balanceCredits,
  maxAdjust,
}: {
  publicId: string
  balanceCredits: number
  maxAdjust: number
}) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<ActionState>({ pending: false })

  const parsed = Number(amount)
  const valid =
    amount.trim() !== '' &&
    Number.isSafeInteger(parsed) &&
    parsed !== 0 &&
    Math.abs(parsed) <= maxAdjust
  const wouldGoNegative = parsed < 0 && balanceCredits + parsed < 0

  async function submit() {
    setState({ pending: true })
    try {
      await sendJson('/api/admin/adjustments', 'POST', {
        userId: publicId,
        credits: parsed,
        note: note.trim(),
      })
      setAmount('')
      setNote('')
      setState({ pending: false, notice: 'Koreksi tercatat di ledger.' })
      router.refresh()
    } catch (cause) {
      setState({ pending: false, error: describe(cause) })
    }
  }

  return (
    <Card title="Koreksi saldo" description={`Ditulis sebagai entri ledger "adjustment". Maksimum ${formatCredits(maxAdjust)} credit per koreksi, boleh negatif.`}>
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Jumlah credit</span>
          <TextInput
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="mis. 250 atau -250"
            size="compact" tone="card" className="tabular-nums"
          />
        </label>
        <label className="flex min-w-56 flex-[2] flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Catatan (wajib)</span>
          <TextInput
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            placeholder="Backfill reward task 12 Agu yang gagal tercatat"
            size="compact" tone="card"
          />
        </label>
      </div>
      {valid ? (
        <p className="text-sm text-muted-foreground tabular-nums">
          Saldo setelah koreksi: {formatCredits(balanceCredits + parsed)} credit
        </p>
      ) : null}
      {wouldGoNegative ? (
        <Alert>Koreksi ini membuat saldo negatif — akan ditolak database.</Alert>
      ) : null}
      <Feedback state={state} />
      <Actions>
        <Primary onClick={submit} disabled={state.pending || !valid || !note.trim() || wouldGoNegative}>
          {state.pending ? 'Menyimpan…' : 'Terapkan koreksi'}
        </Primary>
      </Actions>
    </Card>
  )
}

function Suspension({
  publicId,
  firstName,
  isSuspended,
  isSelf,
}: {
  publicId: string
  firstName: string
  isSuspended: boolean
  isSelf: boolean
}) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [state, setState] = useState<ActionState>({ pending: false })

  async function submit(action: 'suspend' | 'restore') {
    setState({ pending: true })
    try {
      await sendJson(`/api/admin/users/${publicId}`, 'PATCH', {
        action,
        reason: action === 'suspend' ? reason.trim() : undefined,
      })
      setReason('')
      setState({ pending: false })
      router.refresh()
    } catch (cause) {
      setState({ pending: false, error: describe(cause) })
    }
  }

  if (isSuspended) {
    return (
      <Card
        title="Pulihkan akun"
        description={`${firstName} sedang ditangguhkan dan tidak bisa masuk. Memulihkannya mengembalikan akses; sesi lamanya tetap tercabut, jadi ia perlu membuka Mini App lagi.`}
      >
        <Feedback state={state} />
        <Actions>
          <Primary onClick={() => submit('restore')} disabled={state.pending}>
            {state.pending ? 'Menyimpan…' : 'Pulihkan akses'}
          </Primary>
        </Actions>
      </Card>
    )
  }

  return (
    <Card
      title="Tangguhkan akun"
      description="Seluruh sesi aktifnya dicabut di transaksi yang sama. Saldo dan riwayatnya tidak dihapus."
    >
      {isSelf ? (
        <p className="text-sm text-muted-foreground">
          Ini akunmu sendiri — menangguhkannya akan langsung menutup panel ini, jadi aksinya
          dimatikan.
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Alasan (wajib)</span>
          <TextInput
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Beberapa akun menarik ke rekening yang sama."
            size="compact" tone="card"
          />
        </label>
      )}
      <Feedback state={state} />
      <Actions>
        <Danger onClick={() => submit('suspend')} disabled={state.pending || isSelf || !reason.trim()}>
          {state.pending ? 'Menyimpan…' : 'Tangguhkan'}
        </Danger>
      </Actions>
    </Card>
  )
}

function AdminFlag({
  publicId,
  firstName,
  isAdminFlag,
  isAdminByEnv,
  isSelf,
}: {
  publicId: string
  firstName: string
  isAdminFlag: boolean
  isAdminByEnv: boolean
  isSelf: boolean
}) {
  const router = useRouter()
  const [state, setState] = useState<ActionState>({ pending: false })

  async function submit(action: 'grant-admin' | 'revoke-admin') {
    setState({ pending: true })
    try {
      await sendJson(`/api/admin/users/${publicId}`, 'PATCH', { action })
      setState({ pending: false })
      router.refresh()
    } catch (cause) {
      setState({ pending: false, error: describe(cause) })
    }
  }

  return (
    <Card
      title="Hak admin"
      description="Berlaku seketika — hak admin dibaca dari database di setiap request, jadi tidak ada sesi yang perlu dicabut."
    >
      {isAdminByEnv ? (
        <p className="text-sm text-muted-foreground">
          Akun ini juga admin karena `ADMIN_TELEGRAM_ID` menunjuk ke telegram_id-nya. Hak itu tidak
          bisa dicabut dari sini — ubah env var-nya.
        </p>
      ) : null}
      {isSelf && isAdminFlag ? (
        <p className="text-sm text-muted-foreground">
          Hak admin sendiri tidak bisa dicabut dari sini: satu klik akan menutup panel ini untuk
          semua orang, dan pemulihannya hanya lewat shell.
        </p>
      ) : null}
      <Feedback state={state} />
      <Actions>
        {isAdminFlag ? (
          <Danger onClick={() => submit('revoke-admin')} disabled={state.pending || isSelf}>
            {state.pending ? 'Menyimpan…' : `Cabut hak admin ${firstName}`}
          </Danger>
        ) : (
          <Primary onClick={() => submit('grant-admin')} disabled={state.pending}>
            {state.pending ? 'Menyimpan…' : `Jadikan ${firstName} admin`}
          </Primary>
        )}
      </Actions>
    </Card>
  )
}

function Profile({
  publicId,
  firstName,
  username,
}: {
  publicId: string
  firstName: string
  username: string | null
}) {
  const router = useRouter()
  const [name, setName] = useState(firstName)
  const [handle, setHandle] = useState(username ?? '')
  const [state, setState] = useState<ActionState>({ pending: false })

  const changed = name.trim() !== firstName || handle.trim() !== (username ?? '')

  async function submit() {
    setState({ pending: true })
    try {
      await sendJson(`/api/admin/users/${publicId}`, 'PATCH', {
        action: 'profile',
        firstName: name.trim(),
        username: handle.trim() || null,
      })
      setState({ pending: false, notice: 'Profil tersimpan.' })
      router.refresh()
    } catch (cause) {
      setState({ pending: false, error: describe(cause) })
    }
  }

  return (
    <Card
      title="Profil"
      description="Untuk merapikan data lama. Telegram menulis ulang nama dan username ini setiap kali user membuka Mini App, jadi suntingan di sini tidak permanen."
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Nama tampilan</span>
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
            size="compact" tone="card"
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Username (opsional)</span>
          <TextInput
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            maxLength={64}
            placeholder="tanpa @"
            size="compact" tone="card"
          />
        </label>
      </div>
      <Feedback state={state} />
      <Actions>
        <Primary onClick={submit} disabled={state.pending || !changed || !name.trim()}>
          {state.pending ? 'Menyimpan…' : 'Simpan profil'}
        </Primary>
      </Actions>
    </Card>
  )
}

interface ActionState {
  pending: boolean
  error?: string
  notice?: string
}

function describe(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message
  return 'Gagal menyimpan. Coba lagi.'
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Surface as="section" tone="solid" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </Surface>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive">
        {state.error}
      </p>
    )
  }
  if (state.notice) return <p className="text-sm text-foreground">{state.notice}</p>
  return null
}

function Alert({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-destructive">{children}</p>
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <ActionButton size="compact" className="w-auto" onClick={onClick} disabled={disabled}>
      {children}
    </ActionButton>
  )
}

function Danger({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <ActionButton
      variant="danger"
      size="compact"
      className="w-auto"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </ActionButton>
  )
}
