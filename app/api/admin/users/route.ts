import { searchAdminUsers } from '@/server/admin/admin-users'
import { handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:users:${admin.id}`, 300, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const term = new URL(request.url).searchParams.get('q') ?? ''
    const users = await searchAdminUsers(term)
    return Response.json({ users }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
