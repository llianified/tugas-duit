import { getHistoryPage, parseHistoryCursor } from '@/server/history'
import { handleRouteError, rateLimited } from '@/server/http'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
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
