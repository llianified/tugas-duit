'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ApiError, sendJson } from '@/shell/api-client'
import { formatCredits, formatDateTime } from '@/shared/lib/format'

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
  premiumUntil,
  premiumActive,
  notificationsMuted,
  channelMember,
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
  premiumUntil: number | null
  premiumActive: boolean
  notificationsMuted: boolean
  channelMember: boolean | null
}) {
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="user-actions-heading">
      <h3 id="user-actions-heading" className="admin-eyebrow pt-1">
        Saldo dan fasilitas
      </h3>
      <AdjustBalance publicId={publicId} balanceCredits={balanceCredits} maxAdjust={maxAdjust} />
      <Premium publicId={publicId} firstName={firstName} premiumUntil={premiumUntil} active={premiumActive} />
      <TopUp publicId={publicId} />

      <h3 className="admin-eyebrow pt-1">Profil dan komunikasi</h3>
      <Profile publicId={publicId} firstName={firstName} username={username} />
      <Notifications publicId={publicId} muted={notificationsMuted} />
      <ChannelGate publicId={publicId} channelMember={channelMember} />

      <h3 className="admin-eyebrow pt-1 text-destructive">Akses sensitif</h3>
      <Suspension publicId={publicId} firstName={firstName} isSuspended={isSuspended} isSelf={isSelf} />
      <AdminFlag
        publicId={publicId}
        firstName={firstName}
        isAdminFlag={isAdminFlag}
        isAdminByEnv={isAdminByEnv}
        isSelf={isSelf}
      />
    </section>
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
      <div className="flex flex-wrap gap-2.5">
        <label className="admin-field">
          <span className="admin-field-k">Jumlah credit</span>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="mis. 250 atau -250"
            className="focus-ring admin-input tabular-nums"
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-k">Catatan (wajib)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            placeholder="Backfill reward task 12 Agu yang gagal tercatat"
            className="focus-ring admin-input"
          />
        </label>
      </div>
      {valid ? (
        <p className="admin-sub tabular-nums">
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
        <p className="admin-sub">
          Ini akunmu sendiri — menangguhkannya akan langsung menutup panel ini, jadi aksinya
          dimatikan.
        </p>
      ) : (
        <label className="admin-field">
          <span className="admin-field-k">Alasan (wajib)</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Beberapa akun menarik ke rekening yang sama."
            className="focus-ring admin-input"
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
        <p className="admin-sub">
          Akun ini juga admin karena `ADMIN_TELEGRAM_ID` menunjuk ke telegram_id-nya. Hak itu tidak
          bisa dicabut dari sini — ubah env var-nya.
        </p>
      ) : null}
      {isSelf && isAdminFlag ? (
        <p className="admin-sub">
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
      description="Suntingan di sini permanen: begitu disimpan, login berikutnya berhenti menimpa nama dan username dari Telegram untuk akun ini. Foto profil tetap ikut Telegram."
    >
      <div className="flex flex-wrap gap-2.5">
        <label className="admin-field">
          <span className="admin-field-k">Nama tampilan</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
            className="focus-ring admin-input"
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-k">Username (opsional)</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            maxLength={64}
            placeholder="tanpa @"
            className="focus-ring admin-input"
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

/** Premium yang diberikan admin memakai satuan HARI dan menumpuk dari tanggal berakhir yang masih berlaku — bentuk yang sama dengan pembelian, jadi memberi bonus di tengah langganan berbayar tidak memotong hari yang sudah dibayar user. */
function Premium({
  publicId,
  firstName,
  premiumUntil,
  active,
}: {
  publicId: string
  firstName: string
  premiumUntil: number | null
  /** Datang dari server, dihitung dengan `now()` milik database. Menghitungnya di sini akan memanggil `Date.now()` saat render — hasil yang bisa berubah tiap render, dan jam yang berbeda dari yang dipakai server saat menerima aksinya. */
  active: boolean
}) {
  const router = useRouter()
  const [days, setDays] = useState('30')
  const [reason, setReason] = useState('')
  const [state, setState] = useState<ActionState>({ pending: false })

  const parsed = Number(days)
  const validDays = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 730

  async function submit(action: 'premium-grant' | 'premium-revoke') {
    setState({ pending: true })
    try {
      await sendJson(`/api/admin/users/${publicId}`, 'PATCH', {
        action,
        days: action === 'premium-grant' ? parsed : undefined,
        reason: reason.trim(),
      })
      setReason('')
      setState({
        pending: false,
        notice: action === 'premium-grant' ? 'Premium ditambahkan.' : 'Premium dicabut.',
      })
      router.refresh()
    } catch (cause) {
      setState({ pending: false, error: describe(cause) })
    }
  }

  return (
    <Card
      title="Premium"
      description={
        active && premiumUntil
          ? `Aktif sampai ${formatDateTime(premiumUntil)}. Penambahan menumpuk dari tanggal itu, bukan dari hari ini.`
          : 'Belum premium. Penambahan dihitung dari hari ini.'
      }
    >
      <div className="flex flex-wrap gap-2.5">
        <label className="admin-field">
          <span className="admin-field-k">Berapa hari</span>
          <input
            inputMode="numeric"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="focus-ring admin-input tabular-nums"
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-k">Alasan (wajib)</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={280}
            placeholder="Hadiah giveaway Agustus"
            className="focus-ring admin-input"
          />
        </label>
      </div>
      <Feedback state={state} />
      <Actions>
        <Primary
          onClick={() => submit('premium-grant')}
          disabled={state.pending || !validDays || !reason.trim()}
        >
          {state.pending ? 'Menyimpan…' : `Beri ${validDays ? parsed : 0} hari premium`}
        </Primary>
        {active ? (
          <Danger onClick={() => submit('premium-revoke')} disabled={state.pending || !reason.trim()}>
            Cabut premium {firstName}
          </Danger>
        ) : null}
      </Actions>
    </Card>
  )
}

/** Energi dan stok reward mengembalikan KESEMPATAN menghasilkan, bukan mencetak credit. Itu bedanya dengan koreksi saldo, dan alasan keduanya ada di kartu terpisah: user yang dirugikan gangguan sebaiknya dipulihkan lewat sini, bukan lewat saldo yang menambah liabilitas di luar kolam. */
function TopUp({ publicId }: { publicId: string }) {
  const router = useRouter()
  const [energy, setEnergy] = useState('5')
  const [credits, setCredits] = useState('30')
  const [reason, setReason] = useState('')
  const [state, setState] = useState<ActionState>({ pending: false })

  const parsedEnergy = Number(energy)
  const parsedCredits = Number(credits)
  const validEnergy = Number.isSafeInteger(parsedEnergy) && parsedEnergy > 0 && parsedEnergy <= 10
  const validCredits =
    Number.isSafeInteger(parsedCredits) && parsedCredits > 0 && parsedCredits <= 10_000

  async function submit(action: 'energy-grant' | 'pool-refill') {
    setState({ pending: true })
    try {
      await sendJson(`/api/admin/users/${publicId}`, 'PATCH', {
        action,
        amount: action === 'energy-grant' ? parsedEnergy : undefined,
        credits: action === 'pool-refill' ? parsedCredits : undefined,
        reason: reason.trim(),
      })
      setReason('')
      setState({ pending: false, notice: 'Tersimpan. Keduanya dijepit di kapasitas user.' })
      router.refresh()
    } catch (cause) {
      setState({ pending: false, error: describe(cause) })
    }
  }

  return (
    <Card
      title="Energi & stok reward"
      description="Memulihkan kesempatan menghasilkan, bukan mencetak credit. Keduanya dijepit di kapasitas user — kelebihannya tidak disimpan."
    >
      <div className="flex flex-wrap gap-2.5">
        <label className="admin-field">
          <span className="admin-field-k">Energi</span>
          <input
            inputMode="numeric"
            value={energy}
            onChange={(event) => setEnergy(event.target.value)}
            className="focus-ring admin-input tabular-nums"
          />
        </label>
        <label className="admin-field">
          <span className="admin-field-k">Stok reward (credit)</span>
          <input
            inputMode="numeric"
            value={credits}
            onChange={(event) => setCredits(event.target.value)}
            className="focus-ring admin-input tabular-nums"
          />
        </label>
      </div>
      <label className="admin-field">
        <span className="admin-field-k">Alasan (wajib)</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={280}
          placeholder="Kompensasi gangguan 3 Sep"
          className="focus-ring admin-input"
        />
      </label>
      <Feedback state={state} />
      <Actions>
        <Primary
          onClick={() => submit('energy-grant')}
          disabled={state.pending || !validEnergy || !reason.trim()}
        >
          Isi energi
        </Primary>
        <Primary
          onClick={() => submit('pool-refill')}
          disabled={state.pending || !validCredits || !reason.trim()}
        >
          Isi stok reward
        </Primary>
      </Actions>
    </Card>
  )
}

function Notifications({ publicId, muted }: { publicId: string; muted: boolean }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [state, setState] = useState<ActionState>({ pending: false })

  async function submit() {
    setState({ pending: true })
    try {
      await sendJson(`/api/admin/users/${publicId}`, 'PATCH', {
        action: muted ? 'notifications-unmute' : 'notifications-mute',
        reason: reason.trim(),
      })
      setReason('')
      setState({ pending: false })
      router.refresh()
    } catch (cause) {
      setState({ pending: false, error: describe(cause) })
    }
  }

  return (
    <Card
      title="Pesan ajakan bot"
      description={
        muted
          ? 'User ini menekan /stop, jadi pesan ajakan dimatikan. Kabar penarikan tetap terkirim.'
          : 'Pesan ajakan menyala. Mematikannya dari sini setara dengan user mengirim /stop.'
      }
    >
      <p className="admin-field-k">
        Status: <span className={muted ? 'text-muted-foreground' : 'text-success'}>{muted ? 'Nonaktif' : 'Aktif'}</span>
      </p>
      <label className="admin-field">
        <span className="admin-field-k">Alasan (wajib)</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={280}
          placeholder={muted ? 'User minta dinyalakan lagi lewat chat' : 'User minta disetop'}
          className="focus-ring admin-input"
        />
      </label>
      <Feedback state={state} />
      <Actions>
        <Primary onClick={submit} disabled={state.pending || !reason.trim()}>
          {muted ? 'Nyalakan lagi' : 'Setop pesan ajakan'}
        </Primary>
      </Actions>
    </Card>
  )
}

function ChannelGate({
  publicId,
  channelMember,
}: {
  publicId: string
  channelMember: boolean | null
}) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [state, setState] = useState<ActionState>({ pending: false })

  async function submit() {
    setState({ pending: true })
    try {
      await sendJson(`/api/admin/users/${publicId}`, 'PATCH', {
        action: 'channel-gate-reset',
        reason: reason.trim(),
      })
      setReason('')
      setState({ pending: false, notice: 'Cache dihapus. Pemeriksaan berikutnya menanyakan Telegram lagi.' })
      router.refresh()
    } catch (cause) {
      setState({ pending: false, error: describe(cause) })
    }
  }

  const label =
    channelMember === null ? 'belum pernah dicek' : channelMember ? 'anggota' : 'bukan anggota'

  return (
    <Card
      title="Gerbang channel"
      description={`Hasil tersimpan: ${label}. Hasil "anggota" bertahan berjam-jam, jadi user yang keluar channel atau tercatat salah saat Telegram bermasalah butuh reset ini.`}
    >
      <label className="admin-field">
        <span className="admin-field-k">Alasan (wajib)</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={280}
          placeholder="User lapor tertahan gerbang padahal sudah join"
          className="focus-ring admin-input"
        />
      </label>
      <Feedback state={state} />
      <Actions>
        <Primary onClick={submit} disabled={state.pending || !reason.trim()}>
          Reset hasil pemeriksaan
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
    <section className="admin-card">
      <div>
        <h4 className="admin-row-title">{title}</h4>
        <p className="admin-sub">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="admin-actions">{children}</div>
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="admin-note" data-tone="danger">
        {state.error}
      </p>
    )
  }
  if (state.notice) {
    return (
      <p role="status" className="admin-note" data-tone="success">
        {state.notice}
      </p>
    )
  }
  return null
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="admin-note" data-tone="danger">
      {children}
    </p>
  )
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring transition-ui admin-btn admin-btn-primary admin-btn-grow"
    >
      {children}
    </button>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring transition-ui admin-btn admin-btn-danger admin-btn-grow"
    >
      {children}
    </button>
  )
}
