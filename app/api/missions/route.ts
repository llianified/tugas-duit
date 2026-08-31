import { loadEconomyConfig } from '@/server/economy-config'
import { handleRouteError, rateLimited } from '@/server/http'
import { readMissions } from '@/server/missions'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`missions:${user.id}`, 200, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    return Response.json(
      { missions: await readMissions(user.id) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
