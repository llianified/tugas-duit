import { searchAdminUsers } from '@/server/admin-users'
import { handleRouteError } from '@/server/http'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })

    const term = new URL(request.url).searchParams.get('q') ?? ''
    const users = await searchAdminUsers(term)
    return Response.json({ users }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
