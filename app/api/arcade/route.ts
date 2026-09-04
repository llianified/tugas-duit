import { loadEconomyConfig } from '@/server/economy/economy-config'
import { handleRouteError, rateLimited } from '@/server/platform/http'
import { readArcadeState } from '@/server/arcade/arcade'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`arcade:${user.id}`, 200, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    return Response.json(await readArcadeState(user.id), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
