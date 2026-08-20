import { query } from './db'
import { requireAdmin } from './session'

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"

const ONLINE_WINDOW = "5 minutes"

export interface AdminDashboard {
  users: { total: number; newToday: number; banned: number }
  active: { online: number; daily: number; weekly: number; monthly: number }
  tasks: { total: number; today: number }
  paid: { totalCredits: number; todayCredits: number }
  outstandingCredits: number
  payouts: {
    pendingCount: number
    pendingCredits: number
    paidCount: number
    paidCredits: number
    rejectedCount: number
  }
  flaggedUsers: number
  ads: {
    ticketsOpened: number
    ticketsReady: number
    passesConsumed: number
    tasksPaidByAd: number
    tasksPaidByEnergy: number
    creditsOnAdTasks: number
  }
}

export async function readAdminDashboard(): Promise<AdminDashboard> {
  await requireAdmin()

  const rows = await query<Record<string, string>>(
    `select
       (select count(*) from users)::text as users_total,
       (select count(*) from users where (created_at at time zone 'Asia/Jakarta')::date = ${TODAY})::text as users_new_today,
       (select count(*) from users where banned_at is not null)::text as users_banned,

       (select count(distinct user_id) from sessions
         where last_seen_at > now() - interval '${ONLINE_WINDOW}'
           and revoked_at is null and expires_at > now())::text as online,
       (select count(distinct user_id) from task_completions
         where (completed_at at time zone 'Asia/Jakarta')::date = ${TODAY})::text as dau,
       (select count(distinct user_id) from task_completions
         where completed_at > now() - interval '7 days')::text as wau,
       (select count(distinct user_id) from task_completions
         where completed_at > now() - interval '30 days')::text as mau,

       (select count(*) from task_completions)::text as tasks_total,
       (select count(*) from task_completions
         where (completed_at at time zone 'Asia/Jakarta')::date = ${TODAY})::text as tasks_today,

       -- Yang dihitung "dibayar" adalah credit yang masuk ke user: reward task
       -- dan komisi referral. Penahanan penarikan dan refund sengaja tidak ikut —
       -- keduanya memindahkan credit yang sudah pernah dibayar, bukan menambah.
       (select coalesce(sum(amount),0) from credit_ledger
         where kind in ('task','commission'))::text as paid_total,
       (select coalesce(sum(amount),0) from credit_ledger
         where kind in ('task','commission')
           and (created_at at time zone 'Asia/Jakarta')::date = ${TODAY})::text as paid_today,

       (select coalesce(sum(balance_credits),0) from users)::text as outstanding,

       (select count(*) from withdrawals where state='processing')::text as wd_pending_count,
       (select coalesce(sum(credits),0) from withdrawals where state='processing')::text as wd_pending_credits,
       (select count(*) from withdrawals where state='paid')::text as wd_paid_count,
       (select coalesce(sum(credits),0) from withdrawals where state='paid')::text as wd_paid_credits,
       (select count(*) from withdrawals where state='rejected')::text as wd_rejected_count,

       (select count(distinct user_id) from fraud_signals
         where created_at > now() - interval '7 days')::text as flagged,

       -- Iklan, 7 hari terakhir. Jarak dibuka -> siap adalah fill rate; jarak siap ->
       -- terpakai adalah pass yang terbuang. Baris terakhir yang menentukan fase 2 layak
       -- atau tidak: credit yang benar-benar dibayarkan pada task berbayar iklan, untuk
       -- dibandingkan dengan pendapatan GigaPub dari dashboard partner.
       (select count(*) from ad_views
         where created_at > now() - interval '7 days')::text as ads_opened,
       (select count(*) from ad_views
         where ready_at > now() - interval '7 days')::text as ads_ready,
       (select count(*) from ad_views
         where consumed_at > now() - interval '7 days')::text as ads_consumed,
       (select count(*) from challenges c
         join task_completions t on t.challenge_id = c.id
         where c.ad_view_id is not null
           and t.completed_at > now() - interval '7 days')::text as ads_tasks,
       (select count(*) from challenges c
         join task_completions t on t.challenge_id = c.id
         where c.ad_view_id is null and c.energy_spent_at is not null
           and t.completed_at > now() - interval '7 days')::text as energy_tasks,
       (select coalesce(sum(t.reward),0) from challenges c
         join task_completions t on t.challenge_id = c.id
         where c.ad_view_id is not null
           and t.completed_at > now() - interval '7 days')::text as ads_credits`,
  )
  const row = rows[0]
  const n = (key: string) => Number(row[key])

  return {
    users: { total: n('users_total'), newToday: n('users_new_today'), banned: n('users_banned') },
    active: { online: n('online'), daily: n('dau'), weekly: n('wau'), monthly: n('mau') },
    tasks: { total: n('tasks_total'), today: n('tasks_today') },
    paid: { totalCredits: n('paid_total'), todayCredits: n('paid_today') },
    outstandingCredits: n('outstanding'),
    payouts: {
      pendingCount: n('wd_pending_count'),
      pendingCredits: n('wd_pending_credits'),
      paidCount: n('wd_paid_count'),
      paidCredits: n('wd_paid_credits'),
      rejectedCount: n('wd_rejected_count'),
    },
    flaggedUsers: n('flagged'),
    ads: {
      ticketsOpened: n('ads_opened'),
      ticketsReady: n('ads_ready'),
      passesConsumed: n('ads_consumed'),
      tasksPaidByAd: n('ads_tasks'),
      tasksPaidByEnergy: n('energy_tasks'),
      creditsOnAdTasks: n('ads_credits'),
    },
  }
}

export interface AdminActivityEntry {
  kind: 'task' | 'commission' | 'withdrawal_hold' | 'withdrawal_refund' | 'adjustment' | 'signup'
  userName: string
  userPublicId: string
  amount: number | null
  note: string | null
  at: number
}

export async function readAdminActivity(limit = 25): Promise<AdminActivityEntry[]> {
  await requireAdmin()

  const rows = await query<{
    kind: AdminActivityEntry['kind']
    first_name: string
    public_id: string
    amount: string | null
    note: string | null
    at: Date
  }>(
    `select * from (
       select l.kind::text as kind, u.first_name, u.public_id, l.amount::text as amount,
              l.note, l.created_at as at
         from credit_ledger l join users u on u.id = l.user_id
        order by l.created_at desc limit $1
     ) as ledger
     union all
     select * from (
       select 'signup' as kind, u.first_name, u.public_id, null as amount,
              null as note, u.created_at as at
         from users u
        order by u.created_at desc limit $1
     ) as signups
     order by at desc
     limit $1`,
    [Math.min(100, Math.max(1, limit))],
  )

  return rows.map((row) => ({
    kind: row.kind,
    userName: row.first_name,
    userPublicId: row.public_id,
    amount: row.amount === null ? null : Number(row.amount),
    note: row.note,
    at: row.at.getTime(),
  }))
}
