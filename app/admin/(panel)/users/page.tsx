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
      <header className="admin-page-header">
        <h1 className="admin-page-title">Manajemen pengguna</h1>
        <p className="admin-page-description">
          Temukan akun, periksa kondisinya, lalu lakukan koreksi yang dapat diaudit tanpa menimpa riwayat.
        </p>
      </header>

      <form action="/admin/users" className="admin-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label htmlFor="admin-user-search" className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">Cari akun</span>
          <span className="text-xs leading-relaxed text-muted-foreground">Public ID, Telegram ID, username, nama, atau kode referral.</span>
          <input
            id="admin-user-search"
            name="q"
            defaultValue={term}
            autoComplete="off"
            placeholder="Contoh: @budi atau 5231…"
            className="focus-ring rounded-lg border border-border bg-background px-3 py-2.5 text-foreground"
          />
        </label>
        <button type="submit" className="focus-ring transition-ui rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          Cari pengguna
        </button>
      </form>

      {term ? <SearchResults term={term} results={results} selectedId={detail?.publicId} /> : (
        <p className="admin-empty">Masukkan identitas pengguna untuk membuka profil dan alat administrasinya.</p>
      )}

      {id && !detail ? <p className="admin-empty">Akun tidak ditemukan. Mungkin sudah dihapus atau tautannya salah.</p> : null}
      {detail ? <UserDetail detail={detail} adminPublicId={admin.publicId} maxAdjust={maxPayoutCredits()} /> : null}
    </div>
  )
}

function SearchResults({ term, results, selectedId }: { term: string; results: Awaited<ReturnType<typeof searchAdminUsers>>; selectedId?: string }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="search-results-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="search-results-heading" className="font-display text-base font-bold text-foreground">
          {results.length === 0 ? 'Tidak ada hasil' : `${formatCredits(results.length)} akun ditemukan`}
        </h2>
        <p className="text-xs text-muted-foreground">Maksimum 25 hasil</p>
      </div>
      {results.length === 0 ? (
        <p className="admin-empty">Coba kata kunci lain. Akun baru muncul setelah pengguna membuka Mini App sekali.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {results.map((user) => {
            const selected = user.publicId === selectedId
            return (
              <li key={user.publicId}>
                <Link
                  href={`/admin/users?q=${encodeURIComponent(term)}&id=${user.publicId}`}
                  aria-current={selected ? 'true' : undefined}
                  className={selected ? 'focus-ring flex min-h-24 flex-col justify-between gap-3 rounded-lg border border-primary bg-card p-3.5' : 'focus-ring transition-ui flex min-h-24 flex-col justify-between gap-3 rounded-lg border border-border bg-card p-3.5 hover:bg-muted'}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{user.firstName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.username ? `@${user.username}` : user.publicId}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {user.isAdmin ? <Tag>Admin</Tag> : null}
                      {user.bannedAt ? <Tag tone="danger">Ditangguhkan</Tag> : null}
                    </div>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{formatCredits(user.balanceCredits)} credit</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function UserDetail({ detail, adminPublicId, maxAdjust }: { detail: AdminUserDetail; adminPublicId: string; maxAdjust: number }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="admin-panel overflow-hidden">
        <header className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-foreground">{detail.firstName}</h2>
              {detail.isAdmin || detail.isAdminByEnv ? <Tag>Admin</Tag> : null}
              {detail.bannedAt ? <Tag tone="danger">Ditangguhkan</Tag> : <Tag tone="success">Aktif</Tag>}
              {detail.publicId === adminPublicId ? <Tag>Ini kamu</Tag> : null}
            </div>
            <p className="pt-1 text-sm text-muted-foreground">{detail.username ? `@${detail.username}` : 'Tanpa username'} · bergabung {formatHistoryTime(detail.createdAt)}</p>
          </div>
          <div className="sm:text-right">
            <p className="font-display text-2xl font-bold tabular-nums text-foreground">{formatRupiah(creditsToRupiah(detail.balanceCredits))}</p>
            <p className="text-xs tabular-nums text-muted-foreground">{formatCredits(detail.balanceCredits)} credit</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <QuickStat label="Energi" value={formatCredits(detail.energy)} />
          <QuickStat label="Stok reward" value={`${formatCredits(detail.rewardPool)} credit`} />
          <QuickStat label="Task selesai" value={formatCredits(detail.tasksCompleted)} />
          <QuickStat label="Skor risiko" value={formatCredits(detail.riskScore)} danger={detail.riskScore > 0} />
        </div>

        <dl className="grid gap-4 p-4 text-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          <Field label="Public ID"><span className="flex flex-wrap items-center gap-2"><span className="break-all font-medium tabular-nums text-foreground">{detail.publicId}</span><CopyButton value={detail.publicId} /></span></Field>
          <Field label="Telegram ID"><span className="flex flex-wrap items-center gap-2"><span className="font-medium tabular-nums text-foreground">{detail.telegramId}</span><CopyButton value={detail.telegramId} /></span></Field>
          <Field label="Kode referral"><span className="font-medium tabular-nums text-foreground">{detail.referralCode}</span></Field>
          <Field label="Aktivitas"><span className="text-foreground">Streak {formatCredits(detail.streak)} hari</span><span className="text-muted-foreground">{formatCredits(detail.creditsEarnedToday)} credit hari ini</span></Field>
          <Field label="Referral"><span className="text-foreground">{formatCredits(detail.downlineCount)} downline</span>{detail.referredBy ? <Link href={`/admin/users?id=${detail.referredBy.publicId}`} className="focus-ring rounded text-primary hover:underline">Upline: {detail.referredBy.firstName}</Link> : <span className="text-muted-foreground">Tanpa upline</span>}</Field>
          <Field label="Komunikasi"><span className="text-foreground">Ajakan bot {detail.notificationsMutedAt ? 'nonaktif' : 'aktif'}</span><span className="text-muted-foreground">Channel {detail.channelMember === null ? 'belum dicek' : detail.channelMember ? 'terverifikasi' : 'tidak terverifikasi'}</span></Field>
          {detail.bannedAt ? <Field label="Penangguhan"><span className="text-foreground">{detail.banReason ?? 'Tanpa alasan tercatat'}</span><span className="tabular-nums text-muted-foreground">{formatHistoryTime(detail.bannedAt)}</span></Field> : null}
        </dl>
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

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <DetailSection title="Sinyal fraud" description={`Skor ${formatCredits(detail.riskScore)} dalam 7 hari. Gunakan sebagai konteks, bukan vonis.`} empty={detail.fraudSignals.length === 0 ? 'Belum ada sinyal untuk akun ini.' : undefined}>
          {detail.fraudSignals.map((signal, index) => (
            <li key={`${signal.at}-${signal.signal}-${index}`} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-semibold text-foreground">{SIGNAL_LABEL[signal.signal] ?? signal.signal}</span><span className="text-xs tabular-nums text-muted-foreground">Bobot {formatCredits(signal.severity)} · {formatHistoryTime(signal.at)}</span></div>
              {signal.detail ? <details className="text-xs text-muted-foreground"><summary className="focus-ring cursor-pointer rounded py-1 font-medium">Lihat detail teknis</summary><code className="mt-1 block break-all rounded-md bg-background p-2 leading-relaxed">{JSON.stringify(signal.detail)}</code></details> : null}
            </li>
          ))}
        </DetailSection>

        <DetailSection title="Jejak aksi admin" description="Perubahan status dan fasilitas pada akun ini." empty={detail.adminActions.length === 0 ? 'Belum ada aksi admin pada akun ini.' : undefined}>
          {detail.adminActions.map((entry, index) => (
            <li key={`${entry.at}-${entry.action}-${index}`} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-semibold text-foreground">{ADMIN_ACTION_LABEL[entry.action] ?? entry.action}</span><span className="text-xs tabular-nums text-muted-foreground">{formatHistoryTime(entry.at)}</span></div>
              <p className="text-xs leading-relaxed text-muted-foreground">{entry.reason}{entry.adminName ? ` — oleh ${entry.adminName}` : ''}</p>
              {entry.detail ? <details className="text-xs text-muted-foreground"><summary className="focus-ring cursor-pointer rounded py-1 font-medium">Lihat detail teknis</summary><code className="mt-1 block break-all rounded-md bg-background p-2 leading-relaxed">{JSON.stringify(entry.detail)}</code></details> : null}
            </li>
          ))}
        </DetailSection>

        <DetailSection title="Riwayat penarikan" description="Maksimum 20 pengajuan terakhir." empty={detail.withdrawals.length === 0 ? 'Belum pernah mengajukan penarikan.' : undefined}>
          {detail.withdrawals.map((withdrawal) => {
            const channel = getPayoutChannel(withdrawal.channelId)
            return (
              <li key={withdrawal.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-foreground">{formatRupiah(withdrawal.amountIdr)}</span><Tag>{STATE_LABEL[withdrawal.state] ?? withdrawal.state}</Tag></span><span className="text-xs tabular-nums text-muted-foreground">{formatHistoryTime(withdrawal.settledAt ?? withdrawal.requestedAt)}</span></div>
                <p className="text-xs text-muted-foreground">{channel.name} {withdrawal.accountNumber} · {withdrawal.accountName}</p>
                {withdrawal.rejectReason ? <p className="text-xs text-destructive">Alasan: {withdrawal.rejectReason}</p> : null}
                {withdrawal.adminNote ? <p className="text-xs text-muted-foreground">Catatan: {withdrawal.adminNote}</p> : null}
                {withdrawal.processedBy ? <p className="text-xs text-muted-foreground">Diputuskan oleh {withdrawal.processedBy}</p> : null}
              </li>
            )
          })}
        </DetailSection>

        <DetailSection title="Ledger terakhir" description="20 pergerakan saldo terbaru." empty={detail.ledger.length === 0 ? 'Belum ada pergerakan saldo.' : undefined}>
          {detail.ledger.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-semibold text-foreground">{LEDGER_LABEL[entry.kind] ?? entry.kind}</span><span className="text-sm font-medium tabular-nums text-foreground">{entry.amount > 0 ? '+' : '−'}{formatCredits(Math.abs(entry.amount))}</span></div>
              <p className="text-xs tabular-nums text-muted-foreground">Sisa {formatCredits(entry.balanceAfter)} · {formatHistoryTime(entry.createdAt)}</p>
              {entry.note ? <p className="text-xs leading-relaxed text-muted-foreground">{entry.note}</p> : null}
            </li>
          ))}
        </DetailSection>
      </div>
    </div>
  )
}

function QuickStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="flex min-h-20 flex-col justify-center gap-1 bg-card p-3.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={danger ? 'text-sm font-bold tabular-nums text-destructive' : 'text-sm font-bold tabular-nums text-foreground'}>{value}</dd></div>
}

function DetailSection({ title, description, empty, children }: { title: string; description: string; empty?: string; children: ReactNode }) {
  return (
    <section className="admin-panel flex flex-col gap-4 p-4 sm:p-5">
      <div><h3 className="font-display text-base font-bold text-foreground">{title}</h3><p className="pt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
      {empty ? <p className="admin-empty">{empty}</p> : <ul className="flex flex-col divide-y divide-border">{children}</ul>}
    </section>
  )
}

const STATE_LABEL: Record<string, string> = { processing: 'Diproses', paid: 'Terkirim', rejected: 'Ditolak' }
const SIGNAL_LABEL: Record<string, string> = { impossibly_fast: 'Jawaban terlalu cepat untuk manusia', submit_without_start: 'Mengirim jawaban tanpa memulai task', identical_timing: 'Waktu pengerjaan terlalu seragam', no_wrong_attempts: 'Nyaris tidak pernah salah', referral_burst: 'Pendaftar referral menumpuk dalam waktu singkat', ad_claim_without_ticket: 'Klaim iklan tanpa tiket', ad_claim_too_fast: 'Klaim iklan terlalu cepat setelah dibuka', ad_claim_burst: 'Klaim iklan beruntun' }
const ADMIN_ACTION_LABEL: Record<string, string> = { premium_grant: 'Premium diberikan', premium_revoke: 'Premium dicabut', energy_grant: 'Energi diisi', pool_refill: 'Stok reward diisi', notifications_mute: 'Pesan ajakan dimatikan', notifications_unmute: 'Pesan ajakan dinyalakan', channel_gate_reset: 'Cache gerbang channel direset' }
const LEDGER_LABEL: Record<string, string> = { task: 'Reward task', commission: 'Komisi referral', withdrawal_hold: 'Penarikan ditahan', withdrawal_refund: 'Penarikan dikembalikan', adjustment: 'Koreksi admin' }

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="flex flex-col gap-1">{children}</dd></div>
}

function Tag({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'success' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'text-destructive' : tone === 'success' ? 'text-success' : 'text-foreground'
  return <span className={`rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold ${toneClass}`}>{children}</span>
}
