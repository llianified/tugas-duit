import { loadEconomyConfig } from '@/server/economy-config'
import { handleRouteError } from '@/server/http'
import { listPendingPayouts } from '@/server/payout'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await loadEconomyConfig()
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })

    const raw = Number(new URL(request.url).searchParams.get('offset'))
    const offset = Number.isSafeInteger(raw) && raw > 0 ? raw : 0

    const { payouts, hasMore } = await listPendingPayouts(offset)

    return Response.json({ pending: payouts, hasMore, offset })
  } catch (error) {
    return handleRouteError(error)
  }
}
