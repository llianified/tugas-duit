import { getHistoryPage, parseHistoryCursor } from '@/server/task/history'
import { assertNotCrossSite, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const crossSite = assertNotCrossSite(request)
  if (crossSite) return crossSite
  try {
    const user = await requireUser()
    const limit = await checkRateLimit(`history:${user.id}`, 100, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    const cursor = parseHistoryCursor(new URL(request.url).searchParams.get('cursor'))
    return Response.json(await getHistoryPage(user.id, cursor), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
