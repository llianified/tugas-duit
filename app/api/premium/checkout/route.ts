import { isPremiumMonths } from '@/domain/premium'
import { loadEconomyConfig } from '@/server/economy-config'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/http'
import { KlikqrisError } from '@/server/klikqris'
import { PremiumPaymentError, startPremiumCheckout } from '@/server/premium-payment'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`premium:checkout:${user.id}`, 10, 600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = (await request.json().catch(() => null)) as { months?: unknown } | null
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Datanya nggak kebaca. Coba lagi ya.', 400)
    }
    if (!isPremiumMonths(body.months)) {
      return apiError('VALIDATION_FAILED', 'Pilih paket 1, 2, atau 3 bulan ya.', 400)
    }

    const result = await startPremiumCheckout(user.id, body.months)
    if (result.settled) {
      return Response.json(
        { settled: true, premiumUntil: result.premiumUntil },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return Response.json(
      { settled: false, invoice: result.invoice },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof PremiumPaymentError) {
      return apiError(
        error.code,
        error.code === 'PAYMENT_DISABLED'
          ? 'Pembayaran lagi tidak tersedia. Coba lagi nanti ya.'
          : 'Pembayarannya belum bisa diproses. Coba lagi sebentar lagi ya.',
        error.status,
      )
    }
    if (error instanceof KlikqrisError) {
      console.error('[premium] gateway gagal (%s): %s', error.code, error.message)
      return apiError('PAYMENT_GATEWAY_ERROR', 'Gagal bikin QRIS-nya. Coba lagi sebentar lagi ya.', 502)
    }
    return handleRouteError(error)
  }
}
