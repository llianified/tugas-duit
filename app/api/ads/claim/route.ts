import { claimAdTicket } from '@/server/ads/ads'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFUSAL_MESSAGE: Record<string, string> = {
  no_ticket: 'Tiket iklan tidak ketemu. Tonton lagi.',
  ticket_expired: 'Tiket iklan kedaluwarsa. Tonton lagi.',
  pass_ready: 'Tiket iklan kamu sudah siap dipakai.',
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`ads:claim:${user.id}`, 20, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = (await request.json().catch(() => null)) as { ticketId?: string } | null
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Datanya nggak kebaca. Coba lagi ya.', 400)
    }

    const claimed = await claimAdTicket(user.id, body.ticketId ?? '')
    if (!claimed.ok)
      return apiError('AD_CLAIM_REFUSED', REFUSAL_MESSAGE[claimed.reason], 409)

    return Response.json(
      { pass: claimed.pass },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
