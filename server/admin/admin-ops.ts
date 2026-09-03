import { query } from '../platform/db'
import { requireAdmin } from '../auth/session'
import { likeEscaped } from './like'

/** Pembacaan operasional yang tidak muat di halaman lain: tagihan premium, akun bersinyal, dan riwayat penarikan yang sudah selesai. Ketiganya jawaban atas pertanyaan yang sebelumnya hanya bisa dijawab lewat SQL manual. Antrean payout hanya menampilkan `processing`, jadi begitu satu pengajuan diputuskan ia hilang dari pandangan; dashboard menghitung akun bersinyal tanpa menyebut siapa; dan pembayaran premium tidak punya permukaan sama sekali walau ia satu-satunya pemasukan langsung dari user. */

export interface AdminPremiumInvoice {
  orderId: string
  userPublicId: string
  userName: string
  months: number
  amountIdr: number
  totalAmountIdr: number
  state: string
  createdAt: number
  paidAt: number | null
  grantedUntil: number | null
}

export async function readPremiumInvoices(limit = 50): Promise<AdminPremiumInvoice[]> {
  await requireAdmin()
  const rows = await query<{
    order_id: string
    public_id: string
    first_name: string
    months: number
    amount_idr: number
    total_amount_idr: number
    state: string
    created_at: Date
    paid_at: Date | null
    granted_until: Date | null
  }>(
    `select p.order_id, u.public_id, u.first_name, p.months, p.amount_idr, p.total_amount_idr,
            p.state, p.created_at, p.paid_at, p.granted_until
       from premium_payments p
       join users u on u.id = p.user_id
      order by p.created_at desc
      limit $1`,
    [Math.min(200, Math.max(1, limit))],
  )
  return rows.map((row) => ({
    orderId: row.order_id,
    userPublicId: row.public_id,
    userName: row.first_name,
    months: Number(row.months),
    amountIdr: Number(row.amount_idr),
    totalAmountIdr: Number(row.total_amount_idr),
    state: row.state,
    createdAt: row.created_at.getTime(),
    paidAt: row.paid_at?.getTime() ?? null,
    grantedUntil: row.granted_until?.getTime() ?? null,
  }))
}

export interface AdminFlaggedUser {
  publicId: string
  firstName: string
  score: number
  signalCount: number
  signals: string[]
  lastSignalAt: number
  balanceCredits: number
  hasPendingPayout: boolean
}

/** Akun bersinyal tujuh hari terakhir, diurutkan dari skor tertinggi. `hasPendingPayout` ikut dibaca karena itu yang menentukan mendesak atau tidak: akun bersinyal yang tidak sedang menarik apa-apa bisa ditinjau kapan saja, sementara yang antre payout menuntut keputusan sebelum uangnya keluar. */
export async function readFlaggedUsers(limit = 50): Promise<AdminFlaggedUser[]> {
  await requireAdmin()
  const rows = await query<{
    public_id: string
    first_name: string
    score: string
    signal_count: number
    signals: string[]
    last_signal_at: Date
    balance_credits: string
    has_pending_payout: boolean
  }>(
    `select u.public_id, u.first_name,
            sum(f.severity)::text as score,
            count(*)::int as signal_count,
            array_agg(distinct f.signal) as signals,
            max(f.created_at) as last_signal_at,
            u.balance_credits::text as balance_credits,
            exists (select 1 from withdrawals w
                     where w.user_id = u.id and w.state = 'processing') as has_pending_payout
       from fraud_signals f
       join users u on u.id = f.user_id
      where f.created_at > now() - interval '7 days'
      group by u.id
      order by has_pending_payout desc, sum(f.severity) desc, max(f.created_at) desc
      limit $1`,
    [Math.min(200, Math.max(1, limit))],
  )
  return rows.map((row) => ({
    publicId: row.public_id,
    firstName: row.first_name,
    score: Number(row.score),
    signalCount: Number(row.signal_count),
    signals: row.signals,
    lastSignalAt: row.last_signal_at.getTime(),
    balanceCredits: Number(row.balance_credits),
    hasPendingPayout: row.has_pending_payout,
  }))
}

export type PayoutHistoryState = 'paid' | 'rejected' | 'processing' | 'semua'

export interface AdminPayoutHistoryEntry {
  id: string
  userPublicId: string
  userName: string
  channelId: string
  accountNumber: string
  accountName: string
  credits: number
  amountIdr: number
  state: string
  requestedAt: number
  settledAt: number | null
  rejectReason: string | null
  processedBy: string | null
  hasProof: boolean
}

export const PAYOUT_HISTORY_PAGE_SIZE = 50

/** Riwayat penarikan yang bisa dicari, termasuk yang sudah diputuskan. Nomor rekening TIDAK dimask di sini, berbeda dengan yang dikirim ke user lewat `server/payout.ts`. Halaman ini yang dipakai mencocokkan bukti transfer dengan pengajuan saat ada sengketa, dan nomor yang setengah tertutup tidak bisa dicocokkan dengan apa pun. */
export async function readPayoutHistory(input: {
  state: PayoutHistoryState
  term: string
  offset: number
}): Promise<{ entries: AdminPayoutHistoryEntry[]; hasMore: boolean }> {
  await requireAdmin()
  const term = input.term.trim()
  const rows = await query<{
    id: string
    public_id: string
    first_name: string
    channel_id: string
    account_number: string
    account_name: string
    credits: number
    amount_idr: number
    state: string
    requested_at: Date
    paid_at: Date | null
    rejected_at: Date | null
    reject_reason: string | null
    processed_by_name: string | null
    proof_file_id: string | null
  }>(
    `select w.id, u.public_id, u.first_name, w.channel_id, w.account_number, w.account_name,
            w.credits, w.amount_idr, w.state, w.requested_at, w.paid_at, w.rejected_at,
            w.reject_reason, a.first_name as processed_by_name, w.proof_file_id
       from withdrawals w
       join users u on u.id = w.user_id
       left join users a on a.id = w.processed_by
      where ($1::text = 'semua' or w.state = $1::withdrawal_state)
        and (
          $2::text = ''
          or w.account_number like '%' || ${likeEscaped('$2::text')} || '%'
          or u.first_name ilike '%' || ${likeEscaped('$2::text')} || '%'
          or w.account_name ilike '%' || ${likeEscaped('$2::text')} || '%'
        )
      order by w.requested_at desc
      limit $3 offset $4`,
    [input.state, term, PAYOUT_HISTORY_PAGE_SIZE + 1, Math.max(0, input.offset)],
  )

  const page = rows.slice(0, PAYOUT_HISTORY_PAGE_SIZE)
  return {
    hasMore: rows.length > PAYOUT_HISTORY_PAGE_SIZE,
    entries: page.map((row) => ({
      id: row.id,
      userPublicId: row.public_id,
      userName: row.first_name,
      channelId: row.channel_id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      credits: Number(row.credits),
      amountIdr: Number(row.amount_idr),
      state: row.state,
      requestedAt: row.requested_at.getTime(),
      settledAt: row.paid_at?.getTime() ?? row.rejected_at?.getTime() ?? null,
      rejectReason: row.reject_reason,
      processedBy: row.processed_by_name,
      hasProof: row.proof_file_id !== null,
    })),
  }
}
