import { getActivityFeed } from '@/server/activity'
import { loadEconomyConfig } from '@/server/economy-config'
import { handleRouteError, rateLimited } from '@/server/http'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`activity:${user.id}`, 120, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    return Response.json(
      { entries: await getActivityFeed() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
