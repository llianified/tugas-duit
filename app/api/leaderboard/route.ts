import { loadEconomyConfig } from '@/server/economy/economy-config'
import { leaderboardEnabled } from '@/features/leaderboard/availability'
import { handleRouteError, rateLimited } from '@/server/platform/http'
import { getLeaderboard } from '@/server/task/leaderboard'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await loadEconomyConfig()
    if (!leaderboardEnabled()) return new Response('Not Found', { status: 404 })

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
