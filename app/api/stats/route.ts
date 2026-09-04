import { loadEconomyConfig } from '@/server/economy/economy-config'
import { assertNotCrossSite, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'
import { getStats } from '@/server/task/stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const crossSite = assertNotCrossSite(request)
  if (crossSite) return crossSite
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`stats:${user.id}`, 100, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    return Response.json(
      { stats: await getStats(user.id, user.balanceCredits) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
