import { loadEconomyConfig } from '@/server/economy/economy-config'
import { assertNotCrossSite, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { readStoreSnapshot } from '@/server/store/store'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const crossSite = assertNotCrossSite(request)
  if (crossSite) return crossSite
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`store:${user.id}`, 200, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    return Response.json(await readStoreSnapshot(user.id), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
