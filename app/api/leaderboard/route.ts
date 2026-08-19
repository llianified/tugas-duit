import { loadEconomyConfig } from '@/server/economy-config'
import { LEADERBOARD_ENABLED } from '@/features/leaderboard/availability'
import { handleRouteError, rateLimited } from '@/server/http'
import { getLeaderboard } from '@/server/leaderboard'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await loadEconomyConfig()
    if (!LEADERBOARD_ENABLED) return new Response('Not Found', { status: 404 })

    const user = await requireUser()
    const limit = await checkRateLimit(`leaderboard:${user.id}`, 100, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    return Response.json(
      { board: await getLeaderboard(user.id) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
