import { clientIp, handleRouteError, rateLimited } from '@/server/http'
import { getPublicPayouts } from '@/server/payout'
import { checkRateLimit } from '@/server/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const limit = await checkRateLimit(`public-payouts:ip:${clientIp(request)}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    return Response.json(
      { payouts: await getPublicPayouts() },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
