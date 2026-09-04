import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { creditsToRupiah, maxPayoutCredits } from '@/domain/economy/economy'
import { getPayoutChannel } from '@/domain/economy/withdrawal'
import { getAdminUserDetail, searchAdminUsers, type AdminUserDetail } from '@/server/admin/admin-users'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { getSessionUser } from '@/server/auth/session'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { CopyButton } from '../withdrawals/copy-button'
import { UserActions } from './user-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const admin = await getSessionUser()
  if (!admin || admin.bannedAt || !admin.isAdmin) redirect('/admin/login')

  await loadEconomyConfig()
  const { q, id } = await searchParams
  const term = q?.trim() ?? ''
  const [results, detail] = await Promise.all([
    term ? searchAdminUsers(term) : Promise.resolve([]),
    id ? getAdminUserDetail(id) : Promise.resolve(null),
  ])

  return (
    <div className="admin-page">
      <div className="admin-head">
        <h1 className="admin-head-title">User</h1>
        {term ? <span className="chip chip-muted">{formatCredits(results.length)} hasil</span> : null}
      </div>

      <form action="/admin/users" className="admin-card">
        <label htmlFor="admin-user-search" className="admin-field">
          <span className="admin-field-k">Cari akun</span>
          <input
            id="admin-user-search"
            name="q"
            defaultValue={term}
            autoComplete="off"
            placeholder="@budi, public ID, atau kode referral"
            className="focus-ring admin-input"
          />
        </label>
        <button type="submit" className="focus-ring transition-ui admin-btn admin-btn-primary">
          Cari
        </button>
      </form>

      {term ? (
        results.length === 0 ? (
          <p className="admin-empty">
            Tidak ada yang cocok. Akun baru muncul setelah pengguna membuka Mini App sekali.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((user) => {
              const selected = user.publicId === detail?.publicId
              return (
                <li key={user.publicId}>
                  <Link
                    href={`/admin/users?q=${encodeURIComponent(term)}&id=${user.publicId}`}
                    aria-current={selected ? 'true' : undefined}
                    className="focus-ring transition-ui admin-result"
                    data-selected={selected ? 'true' : undefined}
                  >
                    <span className="admin-row-main">
                      <span className="admin-row-title truncate">{user.firstName}</span>
                      <span className="admin-sub truncate">{user.username ? `@${user.username}` : user.publicId}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {user.isAdmin ? <span className="chip chip-primary">Admin</span> : null}
                      {user.bannedAt ? <span className="chip chip-destructive">Tangguh</span> : null}
                      <span className="admin-row-value">{formatCredits(user.balanceCredits)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <p className="admin-empty">Cari akun untuk membuka profil dan alat administrasinya.</p>
      )}

      {id && !detail ? <p className="admin-empty">Akun tidak ditemukan. Mungkin sudah dihapus.</p> : null}
      {detail ? <UserDetail detail={detail} adminPublicId={admin.publicId} maxAdjust={maxPayoutCredits()} /> : null}
    </div>
  )
}

function UserDetail({
  detail,
  adminPublicId,
  maxAdjust,
}: {
  detail: AdminUserDetail
  adminPublicId: string
  maxAdjust: number
}) {
  return (
    <>
      <section className="admin-card" data-flag={detail.riskScore > 0 ? 'true' : undefined}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-bold text-foreground">{detail.firstName}</h2>
            <p className="admin-sub truncate">
              {detail.username ? `@${detail.username}` : 'Tanpa username'} · gabung {formatHistoryTime(detail.createdAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-base font-bold tabular-nums text-foreground">
              {formatRupiah(creditsToRupiah(detail.balanceCredits))}
            </p>
            <p className="admin-sub tabular-nums">{formatCredits(detail.balanceCredits)} credit</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {detail.isAdmin || detail.isAdminByEnv ? <span className="chip chip-primary">Admin</span> : null}
          {detail.publicId === adminPublicId ? <span className="chip chip-muted">Ini kamu</span> : null}
          {detail.bannedAt ? (
            <span className="chip chip-destructive">Ditangguhkan</span>
          ) : (
            <span className="chip chip-success">Aktif</span>
          )}
          {detail.premiumActive ? <span className="chip chip-premium">Premium</span> : null}
        </div>

        <div className="admin-stats">
          <Stat label="Energi" value={formatCredits(detail.energy)} />
          <Stat label="Stok reward" value={formatCredits(detail.rewardPool)} hint="credit" />
          <Stat label="Task selesai" value={formatCredits(detail.tasksCompleted)} />
          <Stat label="Skor risiko" value={formatCredits(detail.riskScore)} urgent={detail.riskScore > 0} />
        </div>

        {detail.bannedAt ? (
          <p className="admin-note" data-tone="danger">
            Ditangguhkan {formatHistoryTime(detail.bannedAt)} · {detail.banReason ?? 'tanpa alasan tercatat'}
          </p>
        ) : null}

        <div className="admin-list">
          <IdRow label="Public ID" value={detail.publicId} />
          <IdRow label="Telegram ID" value={detail.telegramId} />
          <Line label="Kode referral" value={detail.referralCode} />
          <Line
            label="Aktivitas"
            value={`Streak ${formatCredits(detail.streak)} hari`}
            hint={`${formatCredits(detail.creditsEarnedToday)} credit hari ini`}
          />
          <Line
            label="Referral"
            value={`${formatCredits(detail.downlineCount)} downline`}
            hint={detail.referredBy ? `Upline: ${detail.referredBy.firstName}` : 'Tanpa upline'}
          />
          <Line
            label="Komunikasi"
            value={detail.notificationsMutedAt ? 'Ajakan mati' : 'Ajakan aktif'}
            hint={`Channel ${detail.channelMember === null ? 'belum dicek' : detail.channelMember ? 'terverifikasi' : 'tidak terverifikasi'}`}
          />
        </div>
      </section>

      <UserActions
        publicId={detail.publicId}
        firstName={detail.firstName}
        username={detail.username}
        isSuspended={detail.bannedAt !== null}
        isAdminFlag={detail.isAdmin}
        isAdminByEnv={detail.isAdminByEnv}
        isSelf={detail.publicId === adminPublicId}
        balanceCredits={detail.balanceCredits}
        maxAdjust={maxAdjust}
        premiumUntil={detail.premiumUntil}
        premiumActive={detail.premiumActive}
        notificationsMuted={detail.notificationsMutedAt !== null}
        channelMember={detail.channelMember}
      />

      <Block
        title="Sinyal fraud"
        note={`Skor ${formatCredits(detail.riskScore)} dalam 7 hari. Konteks, bukan vonis.`}
        empty={detail.fraudSignals.length === 0 ? 'Belum ada sinyal untuk akun ini.' : undefined}
      >
        {detail.fraudSignals.map((signal, index) => (
          <div className="admin-row" key={`${signal.at}-${signal.signal}-${index}`}>
            <div className="admin-row-main">
              <span className="admin-row-title">{SIGNAL_LABEL[signal.signal] ?? signal.signal}</span>
              <span className="admin-sub tabular-nums">
                Bobot {formatCredits(signal.severity)} · {formatHistoryTime(signal.at)}
              </span>
            </div>
          </div>
        ))}
      </Block>

      <Block
        title="Jejak aksi admin"
        note="Perubahan status dan fasilitas pada akun ini."
        empty={detail.adminActions.length === 0 ? 'Belum ada aksi admin pada akun ini.' : undefined}
      >
        {detail.adminActions.map((entry, index) => (
          <div className="admin-row" key={`${entry.at}-${entry.action}-${index}`}>
            <div className="admin-row-main">
              <span className="admin-row-title">{ADMIN_ACTION_LABEL[entry.action] ?? entry.action}</span>
              <span className="admin-sub">
                {entry.reason}
                {entry.adminName ? ` — ${entry.adminName}` : ''}
              </span>
              <span className="admin-sub tabular-nums">{formatHistoryTime(entry.at)}</span>
            </div>
          </div>
        ))}
      </Block>

      <Block
        title="Riwayat penarikan"
        note="Maksimum 20 pengajuan terakhir."
        empty={detail.withdrawals.length === 0 ? 'Belum pernah mengajukan penarikan.' : undefined}
      >
        {detail.withdrawals.map((withdrawal) => {
          const channel = getPayoutChannel(withdrawal.channelId)
          return (
            <div className="admin-row" key={withdrawal.id}>
              <div className="admin-row-main">
                <span className="admin-row-title">
                  {formatRupiah(withdrawal.amountIdr)} · {STATE_LABEL[withdrawal.state] ?? withdrawal.state}
                </span>
                <span className="admin-sub tabular-nums">
                  {channel.name} {withdrawal.accountNumber} · {withdrawal.accountName}
                </span>
                <span className="admin-sub tabular-nums">
                  {formatHistoryTime(withdrawal.settledAt ?? withdrawal.requestedAt)}
                  {withdrawal.processedBy ? ` · oleh ${withdrawal.processedBy}` : ''}
                </span>
                {withdrawal.rejectReason ? (
                  <span className="text-xs text-destructive">Alasan: {withdrawal.rejectReason}</span>
                ) : null}
                {withdrawal.adminNote ? <span className="admin-sub">Catatan: {withdrawal.adminNote}</span> : null}
              </div>
            </div>
          )
        })}
      </Block>

      <Block
        title="Ledger terakhir"
        note="20 pergerakan saldo terbaru."
        empty={detail.ledger.length === 0 ? 'Belum ada pergerakan saldo.' : undefined}
      >
        {detail.ledger.map((entry) => (
          <div className="admin-row" key={entry.id}>
            <div className="admin-row-main">
              <span className="admin-row-title">{LEDGER_LABEL[entry.kind] ?? entry.kind}</span>
              <span className="admin-sub tabular-nums">
                Sisa {formatCredits(entry.balanceAfter)} · {formatHistoryTime(entry.createdAt)}
              </span>
              {entry.note ? <span className="admin-sub">{entry.note}</span> : null}
            </div>
            <span className="admin-row-value">
              {entry.amount > 0 ? '+' : '−'}
              {formatCredits(Math.abs(entry.amount))}
            </span>
          </div>
        ))}
      </Block>
    </>
  )
}

function Stat({ label, value, hint, urgent = false }: { label: string; value: string; hint?: string; urgent?: boolean }) {
  return (
    <div className="admin-stat" data-urgent={urgent ? 'danger' : undefined}>
      <span className="admin-stat-k">{label}</span>
      <span className="admin-stat-v">{value}</span>
      {hint ? <span className="admin-stat-h">{hint}</span> : null}
    </div>
  )
}

function Line({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-row">
      <div className="admin-row-main">
        <span className="admin-row-title">{label}</span>
        {hint ? <span className="admin-sub">{hint}</span> : null}
      </div>
      <span className="admin-row-value">{value}</span>
    </div>
  )
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-row">
      <div className="admin-row-main">
        <span className="admin-row-title">{label}</span>
        <span className="admin-sub break-all tabular-nums">{value}</span>
      </div>
      <CopyButton value={value} />
    </div>
  )
}

function Block({ title, note, empty, children }: { title: string; note: string; empty?: string; children: ReactNode }) {
  return (
    <section className="admin-card">
      <div>
        <h3 className="admin-eyebrow text-foreground">{title}</h3>
        <p className="admin-sub">{note}</p>
      </div>
      {empty ? <p className="admin-sub">{empty}</p> : <div className="admin-list">{children}</div>}
    </section>
  )
}

const STATE_LABEL: Record<string, string> = { processing: 'Diproses', paid: 'Terkirim', rejected: 'Ditolak' }
const SIGNAL_LABEL: Record<string, string> = {
  impossibly_fast: 'Jawaban terlalu cepat untuk manusia',
  submit_without_start: 'Mengirim jawaban tanpa memulai task',
  identical_timing: 'Waktu pengerjaan terlalu seragam',
  no_wrong_attempts: 'Nyaris tidak pernah salah',
  referral_burst: 'Pendaftar referral menumpuk',
  ad_claim_without_ticket: 'Klaim iklan tanpa tiket',
  ad_claim_too_fast: 'Klaim iklan terlalu cepat',
  ad_claim_burst: 'Klaim iklan beruntun',
}
const ADMIN_ACTION_LABEL: Record<string, string> = {
  premium_grant: 'Premium diberikan',
  premium_revoke: 'Premium dicabut',
  energy_grant: 'Energi diisi',
  pool_refill: 'Stok reward diisi',
  notifications_mute: 'Pesan ajakan dimatikan',
  notifications_unmute: 'Pesan ajakan dinyalakan',
  channel_gate_reset: 'Cache gerbang channel direset',
}
const LEDGER_LABEL: Record<string, string> = {
  task: 'Reward task',
  commission: 'Komisi referral',
  withdrawal_hold: 'Penarikan ditahan',
  withdrawal_refund: 'Penarikan dikembalikan',
  adjustment: 'Koreksi admin',
}
