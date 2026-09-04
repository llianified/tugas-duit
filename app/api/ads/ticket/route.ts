import { openAdTicket } from '@/server/ads/ads'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFUSAL_MESSAGE: Record<string, string> = {
  ads_disabled: 'Iklan lagi tutup.',
  daily_limit: 'Jatah iklan hari ini habis. Coba lagi besok.',
  cooling_down: 'Iklannya belum siap. Tunggu sebentar ya.',
  ticket_open: 'Iklan sebelumnya belum kelar.',
  pass_ready: 'Tiket iklan kamu sudah siap dipakai.',
  entry_open: 'Selesaikan dulu soal dari tiket sebelumnya.',
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`ads:ticket:${user.id}`, 20, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const opened = await openAdTicket(user.id)
    if (!opened.ok)
      return Response.json(
        {
          error: {
            code: 'AD_TICKET_REFUSED',
            message: REFUSAL_MESSAGE[opened.reason] ?? REFUSAL_MESSAGE.ads_disabled,
          },
          reason: opened.reason,
          viewsLeft: opened.viewsLeft,
          cooldownSecondsLeft: opened.cooldownSecondsLeft,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      )

    return Response.json(
      {
        ticketId: opened.ticketId,
        provider: opened.provider,
        unitId: opened.unitId,
        expiresAt: opened.expiresAt,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
