import { getHistoryPage, type HistoryCursor } from '@/server/history'
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
    const raw = new URL(request.url).searchParams.get('cursor')
    const [rawCompletedAt, id] = raw?.split(':', 2) ?? []
    const completedAt = Number(rawCompletedAt)
    const cursor: HistoryCursor | null =
      Number.isFinite(completedAt) && completedAt > 0 && /^\d+$/.test(id ?? '')
        ? { completedAt, id }
        : null
    return Response.json(await getHistoryPage(user.id, cursor), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
