import { loadEconomyConfig } from '@/server/economy-config'
import { handleRouteError, rateLimited } from '@/server/http'
import { listPendingPayouts } from '@/server/payout'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await loadEconomyConfig()
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:withdrawals:${admin.id}`, 300, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const raw = Number(new URL(request.url).searchParams.get('offset'))
    const offset = Number.isSafeInteger(raw) && raw > 0 ? raw : 0

    const { payouts, hasMore } = await listPendingPayouts(offset)

    return Response.json({ pending: payouts, hasMore, offset })
  } catch (error) {
    return handleRouteError(error)
  }
}
