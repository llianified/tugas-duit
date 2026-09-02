import { readChannelGateState } from '@/server/integrations/channel'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`channel:verify:${user.id}`, 20, 600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const gate = await readChannelGateState(user, { force: true })
    return Response.json(gate, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
