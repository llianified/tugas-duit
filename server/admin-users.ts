import { query, transaction } from './db'
import { env } from './env'
import { requireAdmin } from './session'
import { STREAK_EXPRESSION } from './streak-sql'

const SEARCH_LIMIT = 25

export const BAN_REASON_MAX = 500

const PROFILE_NAME_MAX = 64

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class AdminUserError extends Error {
  code: string
  status: number

  constructor(code: string, status: number) {
    super(code)
    this.name = 'AdminUserError'
    this.code = code
    this.status = status
  }
}

export interface AdminUserSummary {
  publicId: string
  telegramId: string
  firstName: string
  username: string | null
  balanceCredits: number
  isAdmin: boolean
  bannedAt: number | null
  createdAt: number
}

export interface AdminUserDetail extends AdminUserSummary {
  banReason: string | null
  referralCode: string
  energy: number
  streak: number
  tasksCompleted: number
  creditsEarnedToday: number
  downlineCount: number
  referredBy: { publicId: string; firstName: string } | null
  isAdminByEnv: boolean
  withdrawals: {
    id: string
    channelId: string
    accountNumber: string
    accountName: string
    credits: number
    amountIdr: number
    state: string
    requestedAt: number
    settledAt: number | null
    rejectReason: string | null
    adminNote: string | null
    processedBy: string | null
  }[]
  ledger: {
    id: string
    kind: string
    amount: number
    balanceAfter: number
    note: string | null
    createdAt: number
  }[]
}

const asTime = (value: Date | string | null): number | null =>
  value === null ? null : new Date(value).getTime()

export async function searchAdminUsers(term: string): Promise<AdminUserSummary[]> {
  await requireAdmin()

  const trimmed = term.trim()
  if (!trimmed) return []

  const rows = await query<{
    public_id: string
    telegram_id: string
    first_name: string
    username: string | null
    balance_credits: string
    is_admin: boolean
    banned_at: Date | null
    created_at: Date
  }>(
    `select public_id,telegram_id,first_name,username,balance_credits,is_admin,banned_at,created_at
     from users
     where ($2::uuid is not null and public_id=$2::uuid)
        or ($3::bigint is not null and telegram_id=$3::bigint)
        or username ilike '%' || replace(replace(replace($1,'\\','\\\\'),'%','\\%'),'_','\\_') || '%'
        or first_name ilike '%' || replace(replace(replace($1,'\\','\\\\'),'%','\\%'),'_','\\_') || '%'
        or upper(referral_code)=upper($1)
     order by created_at desc
     limit ${SEARCH_LIMIT}`,
    [trimmed, UUID_SHAPE.test(trimmed) ? trimmed : null, /^\d{1,18}$/.test(trimmed) ? trimmed : null],
  )

  return rows.map((row) => ({
    publicId: row.public_id,
    telegramId: row.telegram_id,
    firstName: row.first_name,
    username: row.username,
    balanceCredits: Number(row.balance_credits),
    isAdmin: row.is_admin,
    bannedAt: asTime(row.banned_at),
    createdAt: new Date(row.created_at).getTime(),
  }))
}

export async function getAdminUserDetail(publicId: string): Promise<AdminUserDetail | null> {
  await requireAdmin()
  if (!UUID_SHAPE.test(publicId.trim())) return null
  const id = publicId.trim()

  const profileRows = await query<{
    id: string
    public_id: string
    telegram_id: string
    first_name: string
    username: string | null
    balance_credits: string
    energy: number
    referral_code: string
    is_admin: boolean
    banned_at: Date | null
    ban_reason: string | null
    created_at: Date
    streak: number
    tasks_completed: number
    credits_earned_today: number
    downline_count: number
    upline_public_id: string | null
    upline_first_name: string | null
  }>(
    `with target as (
       select id from users where public_id=$1
     ), active_days as (
       select distinct (completed_at at time zone 'Asia/Jakarta')::date as day
       from task_completions where user_id=(select id from target)
     ), today as (
       select (now() at time zone 'Asia/Jakarta')::date as day
     ), streak_days as (
       select day from active_days union select day from today
     ), ordered as (
       select day,(row_number() over(order by day desc))::int as rn from streak_days
     )
     select u.id,u.public_id,u.telegram_id,u.first_name,u.username,u.balance_credits,u.energy,
            u.referral_code,u.is_admin,u.banned_at,u.ban_reason,u.created_at,
            ${STREAK_EXPRESSION} as streak,
            (select count(*) from task_completions where user_id=u.id)::int as tasks_completed,
            coalesce((select credits_earned from daily_quotas
                      where user_id=u.id and quota_date=(now() at time zone 'Asia/Jakarta')::date),0)::int
              as credits_earned_today,
            (select count(*) from users d where d.referred_by=u.id)::int as downline_count,
            up.public_id as upline_public_id,
            up.first_name as upline_first_name
     from users u
     left join users up on up.id=u.referred_by
     where u.public_id=$1`,
    [id],
  )
  const profile = profileRows[0]
  if (!profile) return null

  const [withdrawalRows, ledgerRows] = await Promise.all([
    query<{
      id: string
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
      admin_note: string | null
      processed_by_name: string | null
    }>(
      `select w.id,w.channel_id,w.account_number,w.account_name,w.credits,w.amount_idr,w.state,
              w.requested_at,w.paid_at,w.rejected_at,w.reject_reason,w.admin_note,
              a.first_name as processed_by_name
       from withdrawals w
       left join users a on a.id=w.processed_by
       where w.user_id=$1
       order by w.requested_at desc
       limit 20`,
      [profile.id],
    ),
    query<{
      id: string
      kind: string
      amount: string
      balance_after: string
      note: string | null
      created_at: Date
    }>(
      `select id,kind,amount,balance_after,note,created_at
       from credit_ledger where user_id=$1 order by id desc limit 20`,
      [profile.id],
    ),
  ])

  return {
    publicId: profile.public_id,
    telegramId: profile.telegram_id,
    firstName: profile.first_name,
    username: profile.username,
    balanceCredits: Number(profile.balance_credits),
    isAdmin: profile.is_admin,
    isAdminByEnv:
      env.adminTelegramIdOrNull !== null && profile.telegram_id === env.adminTelegramIdOrNull,
    bannedAt: asTime(profile.banned_at),
    banReason: profile.ban_reason,
    createdAt: new Date(profile.created_at).getTime(),
    referralCode: profile.referral_code,
    energy: Number(profile.energy),
    streak: Number(profile.streak),
    tasksCompleted: Number(profile.tasks_completed),
    creditsEarnedToday: Number(profile.credits_earned_today),
    downlineCount: Number(profile.downline_count),
    referredBy:
      profile.upline_public_id && profile.upline_first_name !== null
        ? { publicId: profile.upline_public_id, firstName: profile.upline_first_name }
        : null,
    withdrawals: withdrawalRows.map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      credits: Number(row.credits),
      amountIdr: Number(row.amount_idr),
      state: row.state,
      requestedAt: new Date(row.requested_at).getTime(),
      settledAt: asTime(row.paid_at) ?? asTime(row.rejected_at),
      rejectReason: row.reject_reason,
      adminNote: row.admin_note,
      processedBy: row.processed_by_name,
    })),
    ledger: ledgerRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      amount: Number(row.amount),
      balanceAfter: Number(row.balance_after),
      note: row.note,
      createdAt: new Date(row.created_at).getTime(),
    })),
  }
}

export async function setUserSuspension(input: {
  adminId: number
  publicId: string
  suspended: boolean
  reason: string | null
}): Promise<{ suspended: boolean } | null> {
  const admin = await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null

  if (input.suspended && input.reason !== null && input.reason.length > BAN_REASON_MAX) {
    throw new AdminUserError('REASON_TOO_LONG', 400)
  }
  if (input.suspended && !input.reason) {
    throw new AdminUserError('REASON_REQUIRED', 400)
  }

  return transaction(async (tx) => {
    const updated = await tx.query<{ id: string; banned_at: Date | null }>(
      input.suspended
        ? `update users set banned_at=now(),ban_reason=$2,updated_at=now()
           where public_id=$1 returning id,banned_at`
        : `update users set banned_at=null,ban_reason=null,updated_at=now()
           where public_id=$1 returning id,banned_at`,
      input.suspended ? [input.publicId.trim(), input.reason] : [input.publicId.trim()],
    )
    const row = updated.rows[0]
    if (!row) return null

    if (Number(row.id) === admin.id) {
      throw new AdminUserError('SELF_SUSPENSION_FORBIDDEN', 400)
    }

    if (input.suspended) {
      await tx.query(
        'update sessions set revoked_at=now() where user_id=$1 and revoked_at is null',
        [row.id],
      )
    }
    return { suspended: row.banned_at !== null }
  })
}

export async function setUserAdminFlag(input: {
  adminId: number
  publicId: string
  isAdmin: boolean
}): Promise<{ isAdmin: boolean } | null> {
  const admin = await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null

  return transaction(async (tx) => {
    const updated = await tx.query<{ id: string; is_admin: boolean }>(
      `update users set is_admin=$2,updated_at=now() where public_id=$1 returning id,is_admin`,
      [input.publicId.trim(), input.isAdmin],
    )
    const row = updated.rows[0]
    if (!row) return null
    if (Number(row.id) === admin.id && !input.isAdmin) {
      throw new AdminUserError('SELF_DEMOTION_FORBIDDEN', 400)
    }
    return { isAdmin: row.is_admin }
  })
}

export async function updateAdminUserProfile(input: {
  publicId: string
  firstName: string
  username: string | null
}): Promise<{ firstName: string; username: string | null } | null> {
  await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null

  const firstName = input.firstName.trim()
  if (!firstName || firstName.length > PROFILE_NAME_MAX) {
    throw new AdminUserError('INVALID_FIRST_NAME', 400)
  }
  const username = input.username?.trim().replace(/^@/, '') || null
  if (username !== null && (username.length > PROFILE_NAME_MAX || !/^\w+$/.test(username))) {
    throw new AdminUserError('INVALID_USERNAME', 400)
  }

  const rows = await query<{ first_name: string; username: string | null }>(
    `update users set first_name=$2,username=$3,profile_overridden_at=now(),updated_at=now()
     where public_id=$1 returning first_name,username`,
    [input.publicId.trim(), firstName, username],
  )
  const row = rows[0]
  return row ? { firstName: row.first_name, username: row.username } : null
}
