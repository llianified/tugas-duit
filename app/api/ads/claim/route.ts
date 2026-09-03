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
  awaiting_verification: 'Menunggu konfirmasi penyedia iklan.',
}

/** Menunggu konfirmasi bukan penolakan yang sama dengan yang lain: klien harus tahu bahwa mencoba lagi sebentar lagi memang berguna, dan itu hanya terbaca kalau kodenya berbeda. */
const REFUSAL_CODE: Record<string, string> = {
  awaiting_verification: 'AD_CLAIM_AWAITING_VERIFICATION',
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    /** Plafonnya jauh di atas satu klaim per tontonan karena mode verifikasi mengubah klaim jadi polling: klien menanyakan tiket yang sama sampai konfirmasi Monetag datang. Lihat `VERIFY_POLL_MS` di `shell/use-ad-pass.ts`. */
    const limit = await checkRateLimit(`ads:claim:${user.id}`, 60, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = (await request.json().catch(() => null)) as { ticketId?: string } | null
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Datanya nggak kebaca. Coba lagi ya.', 400)
    }

    const claimed = await claimAdTicket(user.id, body.ticketId ?? '')
    if (!claimed.ok)
      return apiError(
        REFUSAL_CODE[claimed.reason] ?? 'AD_CLAIM_REFUSED',
        REFUSAL_MESSAGE[claimed.reason],
        409,
      )

    return Response.json(
      { pass: claimed.pass },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
