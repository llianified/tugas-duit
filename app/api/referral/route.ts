import { loadEconomyConfig } from '@/server/economy/economy-config'
import { query } from '@/server/platform/db'
import { env } from '@/server/platform/env'
import { handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function referralShareUrl(code: string): string {
  const bot = process.env.NODE_ENV === 'production' ? env.botUsername : env.botUsernameOrNull
  return bot ? `https://t.me/${bot}/app?startapp=${code}` : ''
}

export async function GET() {
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`referral:${user.id}`, 100, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    const rows = await query<{
      id: string
      display_name: string
      joined_at: Date
      task_count: string
      commission_units: string
      last_active_at: Date | null
    }>(
      `select u.public_id id, u.first_name display_name, u.created_at joined_at,
        count(rc.id) task_count, coalesce(sum(rc.commission_units), 0) commission_units,
        max(rc.created_at) last_active_at
       from users u
       left join referral_commissions rc on rc.downline_id=u.id and rc.upline_id=$1
       where u.referred_by=$1
       group by u.id
       order by u.created_at desc
       limit 100`,
      [user.id],
    )
    const totals = await query<{ pending: string }>(
      'select coalesce((select pending_units from referral_wallets where user_id=$1),0) pending',
      [user.id],
    )
    return Response.json({
      code: user.referralCode,
      shareUrl: referralShareUrl(user.referralCode),
      pendingUnits: Number(totals[0].pending),
      downlines: rows.map((row) => ({
        id: row.id,
        displayName: row.display_name || 'Pengguna',
        joinedAt: row.joined_at.getTime(),
        taskCount: Number(row.task_count),
        commissionUnits: Number(row.commission_units),
        lastActiveAt: row.last_active_at?.getTime() ?? null,
      })),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
