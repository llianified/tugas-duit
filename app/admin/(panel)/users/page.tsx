import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { creditsToRupiah, maxPayoutCredits } from '@/domain/economy'
import { getPayoutChannel } from '@/domain/withdrawal'
import { getAdminUserDetail, searchAdminUsers, type AdminUserDetail } from '@/server/admin-users'
import { loadEconomyConfig } from '@/server/economy-config'
import { getSessionUser } from '@/server/session'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { CopyButton } from '../withdrawals/copy-button'
import { UserActions } from './user-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string }>
}) {
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Data user</h2>
        <p className="text-sm text-muted-foreground">
          Cari akun, periksa keadaannya, dan koreksi yang perlu dibackfill. Koreksi saldo ditulis
          sebagai entri ledger — bukan menimpa angkanya.
        </p>
      </header>

      <form action="/admin/users" className="flex flex-wrap items-end gap-2">
        <label htmlFor="admin-user-search" className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Cari akun</span>
          <span className="text-muted-foreground">
            Public ID, telegram_id, username, nama, atau kode referral.
          </span>
          <input
            id="admin-user-search"
            name="q"
            defaultValue={term}
            autoComplete="off"
            placeholder="mis. 5231… atau @budi"
            className="focus-ring rounded-md bg-muted px-3 py-2 text-foreground"
          />
        </label>
        <button
          type="submit"
          className="focus-ring rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Cari
        </button>
      </form>

      {term ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {results.length === 0
              ? 'Tidak ada akun yang cocok'
              : `${formatCredits(results.length)} akun cocok`}
          </h3>
          {results.length === 0 ? (
            <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              Coba kata kunci lain. Akun baru muncul di sini setelah user membuka Mini App sekali.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((user) => (
                <li key={user.publicId}>
                  <Link
                    href={`/admin/users?q=${encodeURIComponent(term)}&id=${user.publicId}`}
                    aria-current={user.publicId === detail?.publicId ? 'true' : undefined}
                    className={`focus-ring flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg px-4 py-3 text-sm transition-colors ${
                      user.publicId === detail?.publicId
                        ? 'bg-card text-foreground'
                        : 'bg-muted hover:bg-muted-foreground/15'
                    }`}
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-foreground">{user.firstName}</span>
                      {user.username ? (
                        <span className="text-muted-foreground">@{user.username}</span>
                      ) : null}
                      {user.isAdmin ? <Tag>admin</Tag> : null}
                      {user.bannedAt ? <Tag>ditangguhkan</Tag> : null}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatCredits(user.balanceCredits)} credit
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {id && !detail ? (
        <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Akun itu tidak ditemukan. Mungkin sudah dihapus, atau tautannya salah.
        </p>
      ) : null}

      {detail ? (
        <UserDetail detail={detail} adminPublicId={admin.publicId} maxAdjust={maxPayoutCredits()} />
      ) : null}
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg bg-muted p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="font-semibold text-foreground">{detail.firstName}</h3>
            {detail.username ? (
              <span className="text-sm text-muted-foreground">@{detail.username}</span>
            ) : null}
            {detail.isAdmin || detail.isAdminByEnv ? <Tag>admin</Tag> : null}
            {detail.bannedAt ? <Tag>ditangguhkan</Tag> : null}
            {detail.publicId === adminPublicId ? <Tag>ini kamu</Tag> : null}
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="font-semibold text-foreground">
              {formatRupiah(creditsToRupiah(detail.balanceCredits))}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatCredits(detail.balanceCredits)} credit
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Public ID">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums text-foreground">{detail.publicId}</span>
              <CopyButton value={detail.publicId} />
            </span>
          </Field>
          <Field label="Telegram ID">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums text-foreground">{detail.telegramId}</span>
              <CopyButton value={detail.telegramId} />
            </span>
          </Field>
          <Field label="Bergabung">
            <span className="tabular-nums text-foreground">
              {formatHistoryTime(detail.createdAt)}
            </span>
          </Field>
          <Field label="Kode referral">
            <span className="font-medium tabular-nums text-foreground">{detail.referralCode}</span>
          </Field>
          <Field label="Task selesai">
            <span className="tabular-nums text-foreground">
              {formatCredits(detail.tasksCompleted)} · streak {formatCredits(detail.streak)} hari
            </span>
          </Field>
          <Field label="Hari ini">
            <span className="tabular-nums text-foreground">
              {formatCredits(detail.creditsEarnedToday)} credit · energy{' '}
              {formatCredits(detail.energy)}
            </span>
          </Field>
          <Field label="Referral">
            <span className="tabular-nums text-foreground">
              {formatCredits(detail.downlineCount)} downline
            </span>
            {detail.referredBy ? (
              <Link
                href={`/admin/users?id=${detail.referredBy.publicId}`}
                className="focus-ring rounded-md text-foreground underline underline-offset-4"
              >
                Upline: {detail.referredBy.firstName}
              </Link>
            ) : (
              <span className="text-muted-foreground">Tanpa upline</span>
            )}
          </Field>
          {detail.bannedAt ? (
            <Field label="Alasan penangguhan">
              <span className="text-foreground">{detail.banReason ?? 'Tanpa alasan tercatat'}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatHistoryTime(detail.bannedAt)}
              </span>
            </Field>
          ) : null}
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

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Sinyal fraud{' '}
          <span className="font-normal text-muted-foreground">
            · skor {formatCredits(detail.riskScore)} (7 hari)
          </span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Sinyal hanya mencatat — tidak pernah mengubah reward maupun menolak pembayaran.
          Bacanya sebagai konteks sebelum menyetujui payout, bukan sebagai vonis.
        </p>
        {detail.fraudSignals.length === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada sinyal untuk akun ini.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.fraudSignals.map((signal, index) => (
              <li
                key={`${signal.at}-${signal.signal}-${index}`}
                className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground">
                    {SIGNAL_LABEL[signal.signal] ?? signal.signal}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    bobot {formatCredits(signal.severity)} · {formatHistoryTime(signal.at)}
                  </span>
                </div>
                {signal.detail ? (
                  <span className="break-all text-muted-foreground">
                    {JSON.stringify(signal.detail)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Jejak aksi admin</h3>
        {detail.adminActions.length === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada aksi admin pada akun ini. Koreksi saldo tercatat di ledger, bukan di sini.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.adminActions.map((entry, index) => (
              <li
                key={`${entry.at}-${entry.action}-${index}`}
                className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground">
                    {ADMIN_ACTION_LABEL[entry.action] ?? entry.action}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatHistoryTime(entry.at)}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {entry.reason}
                  {entry.adminName ? ` — oleh ${entry.adminName}` : ''}
                </span>
                {entry.detail ? (
                  <span className="break-all text-muted-foreground">
                    {JSON.stringify(entry.detail)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Riwayat penarikan</h3>
        {detail.withdrawals.length === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            Belum pernah mengajukan penarikan.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.withdrawals.map((withdrawal) => {
              const channel = getPayoutChannel(withdrawal.channelId)
              return (
                <li
                  key={withdrawal.id}
                  className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-foreground">
                        {formatRupiah(withdrawal.amountIdr)}
                      </span>
                      <Tag>{STATE_LABEL[withdrawal.state] ?? withdrawal.state}</Tag>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatHistoryTime(withdrawal.settledAt ?? withdrawal.requestedAt)}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {channel.name} {withdrawal.accountNumber} · {withdrawal.accountName}
                  </span>
                  {withdrawal.rejectReason ? (
                    <span className="text-muted-foreground">
                      Alasan: {withdrawal.rejectReason}
                    </span>
                  ) : null}
                  {withdrawal.adminNote ? (
                    <span className="text-muted-foreground">Catatan: {withdrawal.adminNote}</span>
                  ) : null}
                  {withdrawal.processedBy ? (
                    <span className="text-muted-foreground">
                      Diputuskan oleh {withdrawal.processedBy}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">20 entri ledger terakhir</h3>
        {detail.ledger.length === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada pergerakan saldo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.ledger.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground">
                    {LEDGER_LABEL[entry.kind] ?? entry.kind}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {entry.amount > 0 ? '+' : '−'}
                    {formatCredits(Math.abs(entry.amount))} · sisa{' '}
                    {formatCredits(entry.balanceAfter)}
                  </span>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {formatHistoryTime(entry.createdAt)}
                </span>
                {entry.note ? <span className="text-muted-foreground">{entry.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const STATE_LABEL: Record<string, string> = {
  processing: 'diproses',
  paid: 'terkirim',
  rejected: 'ditolak',
}

const SIGNAL_LABEL: Record<string, string> = {
  impossibly_fast: 'Jawaban terlalu cepat untuk manusia',
  submit_without_start: 'Mengirim jawaban tanpa memulai task',
  identical_timing: 'Waktu pengerjaan terlalu seragam',
  no_wrong_attempts: 'Nyaris tidak pernah salah',
  referral_burst: 'Pendaftar referral menumpuk dalam waktu singkat',
  ad_claim_without_ticket: 'Klaim iklan tanpa tiket',
  ad_claim_too_fast: 'Klaim iklan terlalu cepat setelah dibuka',
  ad_claim_burst: 'Klaim iklan beruntun',
}

const ADMIN_ACTION_LABEL: Record<string, string> = {
  premium_grant: 'Premium diberikan',
  premium_revoke: 'Premium dicabut',
  energy_grant: 'Energi diisi',
  pool_refill: 'Stok reward diisi',
  notifications_mute: 'Pesan ajakan disetop',
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">{children}</dd>
    </div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-card px-2 py-0.5 text-xs font-medium text-foreground">
      {children}
    </span>
  )
}
