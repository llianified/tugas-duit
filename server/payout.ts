import { creditsToRupiah, maxPayoutCredits, withdrawalMinimumCredits } from '@/domain/economy'
import { isPremiumActive, withdrawalCooldownMs } from '@/domain/premium'
import {
  getPayoutChannel,
  isDraftValid,
  maskAccountNumber,
  PAYOUT_CHANNELS,
  sanitizeAccountNumber,
  validateWithdrawalDraft,
} from '@/features/withdraw/domain'
import type { PoolClient } from 'pg'
import { query, transaction } from './db'
import { appendLedger } from './ledger'
import {
  REQUIRED_ACTIVE_DAYS,
  REQUIRED_ACTIVE_REFERRALS,
  WITHDRAWAL_COOLDOWN_MS,
} from './payout-rules'
import { requireAdmin, UnauthorizedError } from './session'

export class PayoutError extends Error {
  code: string
  status: number
  fields?: Record<string, string | null>

  constructor(code: string, status: number, fields?: Record<string, string | null>) {
    super(code)
    this.name = 'PayoutError'
    this.code = code
    this.status = status
    this.fields = fields
  }
}

const PG_UNIQUE_VIOLATION = '23505'
export { REQUIRED_ACTIVE_DAYS, REQUIRED_ACTIVE_REFERRALS, WITHDRAWAL_COOLDOWN_MS }

interface PayoutEligibility {
  activeReferralCount: number
  requiredActiveReferrals: number
  /** Hari WIB berbeda yang pernah punya minimal satu task selesai. */
  activeDays: number
  requiredActiveDays: number
  cooldownEndsAt: number | null
  /** Jeda yang benar-benar berlaku untuk user ini — 3 hari kalau premium, 7 kalau tidak. */
  cooldownDays: number
}

const ELIGIBILITY_SQL = `select
   (select count(distinct downline_id) from referral_commissions where upline_id=$1) active_referral_count,
   (select count(distinct (completed_at at time zone 'Asia/Jakarta')::date)
      from task_completions where user_id=$1) active_days,
   (select max(requested_at) from withdrawals where user_id=$1) last_requested_at,
   (select premium_until from users where id=$1) premium_until`

type EligibilityRow = {
  active_referral_count: string
  active_days: string
  last_requested_at: Date | null
  premium_until: Date | null
}

/**
 * Satu-satunya pembaca kelayakan penarikan, dipakai jalur baca maupun jalur tulis.
 *
 * Dulu keduanya punya SQL kembar. Saat premium menambahkan jeda 3 hari, hanya jalur tulis
 * yang ikut diubah — jalur baca tetap memakai 7 hari, sehingga UI menggerbang user premium
 * sampai hari ketujuh padahal server sudah menerima pengajuannya sejak hari ketiga. Yang
 * memperbaikinya bukan menyamakan konstantanya, melainkan menghapus salinannya.
 *
 * Bentuk `tx?` mengikuti `run()` di `reward-pool.ts` dan `ads.ts`: ikut transaksi saat
 * dipakai `createPayout`, berdiri sendiri saat sekadar dibaca.
 */
async function readEligibility(userId: number, tx?: PoolClient): Promise<PayoutEligibility> {
  const rows = tx
    ? (await tx.query<EligibilityRow>(ELIGIBILITY_SQL, [userId])).rows
    : await query<EligibilityRow>(ELIGIBILITY_SQL, [userId])
  const row = rows[0]
  const now = Date.now()
  const premium = isPremiumActive(row.premium_until ? row.premium_until.getTime() : null, now)
  const cooldownMs = withdrawalCooldownMs(premium)
  const endsAt = row.last_requested_at ? row.last_requested_at.getTime() + cooldownMs : null

  return {
    activeReferralCount: Number(row.active_referral_count),
    requiredActiveReferrals: REQUIRED_ACTIVE_REFERRALS,
    activeDays: Number(row.active_days),
    requiredActiveDays: REQUIRED_ACTIVE_DAYS,
    cooldownEndsAt: endsAt && endsAt > now ? endsAt : null,
    cooldownDays: Math.round(cooldownMs / 86_400_000),
  }
}

interface PayoutRow {
  id: string
  channel_id: string
  account_number: string
  account_name: string
  credits: number
  amount_idr: number
  state: 'processing' | 'paid' | 'rejected'
  requested_at: Date
  paid_at: Date | null
  rejected_at: Date | null
  reject_reason: string | null
  proof_file_id: string | null
}

const view = (row: PayoutRow) => ({
  id: row.id,
  channelId: row.channel_id,
  accountNumber: maskAccountNumber(row.account_number),
  accountName: row.account_name,
  credits: row.credits,
  amountIdr: row.amount_idr,
  state: row.state,
  requestedAt: row.requested_at.getTime(),
  paidAt: row.paid_at?.getTime() ?? null,
  rejectedAt: row.rejected_at?.getTime() ?? null,
  rejectReason: row.reject_reason,
  hasProof: row.proof_file_id !== null,
})

export async function savePayoutProof(id: string, fileId: string): Promise<void> {
  await query(
    "update withdrawals set proof_file_id=$2,proof_sent_at=now() where id=$1 and state='paid'",
    [id, fileId],
  )
}

export async function readPayoutProofFileId(
  userId: number,
  id: string,
): Promise<string | null> {
  const rows = await query<{ proof_file_id: string | null }>(
    "select proof_file_id from withdrawals where id=$1 and user_id=$2 and state='paid'",
    [id, userId],
  )
  return rows[0]?.proof_file_id ?? null
}

function sharedDestinationChannels(channelId: string): string[] {
  const channel = getPayoutChannel(channelId)
  if (channel.kind !== 'ewallet') return [channel.id]
  return PAYOUT_CHANNELS.filter((candidate) => candidate.kind === 'ewallet').map(
    (candidate) => candidate.id,
  )
}

export async function createPayout(
  userId: number,
  body: { channelId: string; accountNumber: string; accountName: string; credits: number },
) {
  if (!Number.isInteger(body.credits) || body.credits <= 0) {
    throw new PayoutError('VALIDATION_FAILED', 400)
  }
  if (body.credits > maxPayoutCredits()) {
    throw new PayoutError('ABOVE_MAXIMUM', 400)
  }
  if (!PAYOUT_CHANNELS.some((channel) => channel.id === body.channelId)) {
    throw new PayoutError('INVALID_CHANNEL', 400)
  }

  return transaction(async (tx) => {
    const locked = await tx.query<{ balance_credits: string }>(
      'select balance_credits from users where id=$1 for update',
      [userId],
    )
    const lockedUser = locked.rows[0]
    if (!lockedUser) throw new UnauthorizedError()
    const balance = Number(lockedUser.balance_credits)

    const pending = await tx.query("select 1 from withdrawals where user_id=$1 and state='processing'", [
      userId,
    ])
    if (pending.rowCount) throw new PayoutError('WITHDRAWAL_ALREADY_PENDING', 409)

    const errors = validateWithdrawalDraft(
      {
        channelId: body.channelId,
        accountNumber: body.accountNumber,
        accountName: body.accountName,
        amount: String(body.credits),
      },
      balance,
    )
    if (!isDraftValid(errors)) throw new PayoutError('VALIDATION_FAILED', 400, { ...errors })
    if (body.credits < withdrawalMinimumCredits()) throw new PayoutError('BELOW_MINIMUM', 400)
    if (body.credits > balance) throw new PayoutError('INSUFFICIENT_BALANCE', 400)

    const eligibility = await readEligibility(userId, tx)
    if (eligibility.activeDays < eligibility.requiredActiveDays) {
      throw new PayoutError('ACTIVE_DAYS_REQUIRED', 403, {
        activeDays: String(eligibility.activeDays),
        requiredActiveDays: String(eligibility.requiredActiveDays),
      })
    }
    if (eligibility.activeReferralCount < eligibility.requiredActiveReferrals) {
      throw new PayoutError('ACTIVE_REFERRALS_REQUIRED', 403, {
        activeReferralCount: String(eligibility.activeReferralCount),
        requiredActiveReferrals: String(eligibility.requiredActiveReferrals),
      })
    }
    if (eligibility.cooldownEndsAt) {
      throw new PayoutError('WITHDRAWAL_COOLDOWN', 429, {
        cooldownEndsAt: String(eligibility.cooldownEndsAt),
      })
    }

    const destination = sanitizeAccountNumber(body.accountNumber)
    const taken = await tx.query(
      'select 1 from withdrawals where channel_id=any($1::text[]) and account_number=$2 and user_id<>$3 limit 1',
      [sharedDestinationChannels(body.channelId), destination, userId],
    )
    if (taken.rows.length) throw new PayoutError('ACCOUNT_NUMBER_IN_USE', 409)

    const id = (await tx.query<{ id: string }>('select gen_random_uuid() id')).rows[0].id

    const hold = await appendLedger(tx, {
      userId,
      kind: 'withdrawal_hold',
      amount: -body.credits,
      idempotencyKey: `withdrawal:${id}`,
      referenceId: id,
    })

    try {
      const inserted = await tx.query<PayoutRow>(
        `insert into withdrawals(id,user_id,channel_id,account_number,account_name,credits,amount_idr,hold_ledger_id)
         values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [
          id,
          userId,
          body.channelId,
          destination,
          body.accountName.trim(),
          body.credits,
          creditsToRupiah(body.credits),
          hold.ledgerId,
        ],
      )
      return {
        withdrawal: view(inserted.rows[0]),
        balance: hold.balance,
        cooldownDays: eligibility.cooldownDays,
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error as { code?: string }).code === PG_UNIQUE_VIOLATION &&
        (error as { constraint?: string }).constraint === 'withdrawals_one_active_per_user'
      ) {
        throw new PayoutError('WITHDRAWAL_ALREADY_PENDING', 409)
      }
      throw error
    }
  })
}

const PUBLIC_PAYOUT_LIMIT = 10

interface PublicPayoutRow {
  account_name: string
  channel_id: string
  credits: number
  amount_idr: number
  paid_at: Date
}

export function maskPayoutRecipient(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '***'
  return words
    .slice(0, 3)
    .map((word) => `${word.slice(0, 1).toLocaleUpperCase('id-ID')}${'*'.repeat(Math.min(3, Math.max(1, word.length - 1)))}`)
    .join(' ')
}

export async function getPublicPayouts(limit = PUBLIC_PAYOUT_LIMIT) {
  const safeLimit = Math.min(PUBLIC_PAYOUT_LIMIT, Math.max(1, Math.trunc(limit)))
  const rows = await query<PublicPayoutRow>(
    `select account_name,channel_id,credits,amount_idr,paid_at
     from withdrawals
     where state='paid' and paid_at is not null
     order by paid_at desc
     limit $1`,
    [safeLimit],
  )

  return rows.map((row) => ({
    recipient: maskPayoutRecipient(row.account_name),
    channelId: row.channel_id,
    credits: Number(row.credits),
    amountIdr: Number(row.amount_idr),
    paidAt: row.paid_at.getTime(),
  }))
}

export async function getPayouts(userId: number) {
  const [rows, totals, eligibility] = await Promise.all([
    query<PayoutRow>('select * from withdrawals where user_id=$1 order by requested_at desc limit 20', [
      userId,
    ]),
    query<{ withdrawn_credits: string; processing_credits: string }>(
      `select coalesce(sum(credits) filter(where state='paid'),0) withdrawn_credits,
              coalesce(sum(credits) filter(where state='processing'),0) processing_credits
       from withdrawals where user_id=$1`,
      [userId],
    ),
    readEligibility(userId),
  ])

  return {
    withdrawals: rows.map(view),
    totals: {
      withdrawnCredits: Number(totals[0].withdrawn_credits),
      processingCredits: Number(totals[0].processing_credits),
    },
    eligibility,
  }
}

interface SettledPayout {
  withdrawal: { id: string; state: string }
  notice: {
    telegramId: string
    channelId: string
    accountNumber: string
    accountName: string
    credits: number
    amountIdr: number
    cooldownDays: number
  }
}

export async function settlePayout(
  adminId: number,
  id: string,
  action: 'paid' | 'rejected',
  reason: string,
  note: string | null,
): Promise<SettledPayout | null> {
  return transaction(async (tx) => {
    const locked = await tx.query<{
      user_id: string
      telegram_id: string
      credits: number
      state: string
      channel_id: string
      account_number: string
      account_name: string
      amount_idr: number
      premium_until: Date | null
    }>(
      `select w.user_id,u.telegram_id,w.credits,w.state,w.channel_id,w.account_number,w.account_name,
              w.amount_idr,u.premium_until
       from withdrawals w join users u on u.id=w.user_id
       where w.id=$1 for update of w`,
      [id],
    )
    const wd = locked.rows[0]
    if (!wd) return null
    if (wd.state !== 'processing') throw new PayoutError('ALREADY_SETTLED', 409)

    if (action === 'rejected') {
      await appendLedger(tx, {
        userId: Number(wd.user_id),
        kind: 'withdrawal_refund',
        amount: wd.credits,
        idempotencyKey: `withdrawal_refund:${id}`,
        referenceId: id,
        note: reason,
      })
    }

    const updated = await tx.query<{ id: string; state: string }>(
      `update withdrawals set state=$2::withdrawal_state,
         paid_at=case when $2::text='paid' then now() end,
         rejected_at=case when $2::text='rejected' then now() end,
         reject_reason=$3,processed_by=$4,admin_note=$5
       where id=$1 returning id,state`,
      [id, action, action === 'rejected' ? reason : null, adminId, note],
    )

    return {
      withdrawal: updated.rows[0],
      notice: {
        telegramId: wd.telegram_id,
        channelId: wd.channel_id,
        accountNumber: wd.account_number,
        accountName: wd.account_name,
        credits: wd.credits,
        amountIdr: Number(wd.amount_idr),
        cooldownDays: Math.round(
          withdrawalCooldownMs(
            isPremiumActive(wd.premium_until ? wd.premium_until.getTime() : null, Date.now()),
          ) / 86_400_000,
        ),
      },
    }
  })
}

interface PendingPayout {
  id: string
  user: { id: string; firstName: string; telegramId: string }
  channelId: string
  accountNumber: string
  accountName: string
  credits: number
  amountIdr: number
  requestedAt: number
  risk: {
    score: number
    accountAgeDays: number
    sharedDestinationAccounts: number
  }
}

export const PENDING_PAYOUT_PAGE_SIZE = 100

interface PendingPayoutPage {
  payouts: PendingPayout[]
  hasMore: boolean
}

export async function listPendingPayouts(offset = 0): Promise<PendingPayoutPage> {
  await requireAdmin()

  const rows = await query<{
    id: string
    public_id: string
    first_name: string
    telegram_id: string
    channel_id: string
    account_number: string
    account_name: string
    credits: number
    amount_idr: number
    requested_at: Date
    risk_score: string
    account_age_days: number
    shared_destination_accounts: string
  }>(
    `select w.*,u.public_id,u.first_name,u.telegram_id,
            coalesce(sum(f.severity),0) risk_score,
            extract(day from(now()-u.created_at))::int account_age_days,
            -- Akun lain yang menarik ke tujuan yang sama. Subquery, bukan join:
            -- ia tidak boleh ikut mengalikan baris fraud_signals di atas, dan
            -- withdrawals_destination_idx melayaninya langsung.
            (select count(distinct w2.user_id) from withdrawals w2
              where w2.channel_id=w.channel_id
                and w2.account_number=w.account_number
                and w2.user_id<>w.user_id) shared_destination_accounts
     from withdrawals w
     join users u on u.id=w.user_id
     left join fraud_signals f on f.user_id=u.id and f.created_at>now()-interval '7 days'
     where w.state='processing'
     group by w.id,u.id
     order by w.requested_at
     limit $1 offset $2`,
    [PENDING_PAYOUT_PAGE_SIZE + 1, Math.max(0, offset)],
  )

  const page = rows.slice(0, PENDING_PAYOUT_PAGE_SIZE)

  return {
    hasMore: rows.length > PENDING_PAYOUT_PAGE_SIZE,
    payouts: page.map((row) => ({
      id: row.id,
      user: { id: row.public_id, firstName: row.first_name, telegramId: row.telegram_id },
      channelId: row.channel_id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      credits: row.credits,
      amountIdr: row.amount_idr,
      requestedAt: row.requested_at.getTime(),
      risk: {
        score: Number(row.risk_score),
        accountAgeDays: row.account_age_days,
        sharedDestinationAccounts: Number(row.shared_destination_accounts),
      },
    })),
  }
}
