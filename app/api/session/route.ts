import { economyConfig } from '@/domain/economy-config'
import { loadEconomyConfig } from '@/server/economy-config'
import { readAdsState } from '@/server/ads'
import { query } from '@/server/db'
import { readEnergy } from '@/server/energy'
import { env } from '@/server/env'
import { assertSameOrigin, clientIp, handleRouteError, rateLimited } from '@/server/http'
import { readRewardPool } from '@/server/reward-pool'
import { checkRateLimit } from '@/server/ratelimit'
import { destroySession, getSessionUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BREAKDOWN_SQL = `select coalesce(sum(amount) filter(where kind='task'),0) task_credits,
       coalesce(sum(amount) filter(where kind='commission'),0) referral_credits,
       (select coalesce(sum(credits),0) from withdrawals where user_id=$1 and state='paid') withdrawn_credits
  from credit_ledger where user_id=$1`

export async function GET(request: Request) {
  try {
    await loadEconomyConfig()
    const user = await getSessionUser()
    const limit = user
      ? await checkRateLimit(`session:${user.id}`, 100, 3_600)
      : await checkRateLimit(`session:ip:${clientIp(request)}`, 100, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    if (!user) {
      const bot = env.botUsernameOrNull
      return Response.json({
        user: null,
        economy: economyConfig(),
        botAppUrl: bot ? `https://t.me/${bot}/app` : null,
      })
    }

    const [breakdown, energy, rewardPool, ads] = await Promise.all([
      query<{
        task_credits: string
        referral_credits: string
        withdrawn_credits: string
      }>(BREAKDOWN_SQL, [user.id]),
      readEnergy(user.id),
      readRewardPool(user.id),
      readAdsState(user.id),
    ])

    return Response.json({
      user: {
        id: user.publicId,
        firstName: user.firstName,
        username: user.username,
        photoUrl: user.photoUrl,
        balance: user.balanceCredits,
        referralCode: user.referralCode,
        banned: Boolean(user.bannedAt),
      },
      economy: economyConfig(),
      breakdown: {
        taskCredits: Number(breakdown[0].task_credits),
        referralCredits: Number(breakdown[0].referral_credits),
        withdrawnCredits: Number(breakdown[0].withdrawn_credits),
      },
      energy,
      rewardPool,
      ads,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await destroySession()
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
