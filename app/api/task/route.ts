import { loadEconomyConfig } from '@/server/economy/economy-config'
import { issueChallenge } from '@/server/task/challenge'
import { assertNotCrossSite, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const crossSite = assertNotCrossSite(request)
  if (crossSite) return crossSite
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`task:issue:${user.id}`, 60, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    return Response.json(
      { challenge: await issueChallenge(user.id) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
