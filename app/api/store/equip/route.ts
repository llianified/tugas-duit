import { loadEconomyConfig } from '@/server/economy/economy-config'
import { apiError, assertSameOrigin, handleRouteError, rateLimited, readJsonBody } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { equipCosmetic } from '@/server/store/store'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Memasang atau melepas kosmetik. Yang dipasang tampil di papan peringkat — satu-satunya permukaan
 * publik aplikasi ini — jadi kepemilikannya diperiksa di server, bukan cuma tombolnya dimatikan di
 * klien. */
export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`store:equip:${user.id}`, 120, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{ slot?: unknown; key?: unknown }>(request)
    const slot = body?.slot === 'frame' || body?.slot === 'title' ? body.slot : null
    if (!slot) return apiError('EQUIP_REFUSED', 'Pilihannya nggak kebaca. Coba lagi ya.', 400)

    const key = body?.key === null || body?.key === undefined ? null : body.key
    const result = await equipCosmetic(user.id, slot, key)
    if (!result.ok) {
      return apiError(
        'EQUIP_REFUSED',
        result.reason === 'not_owned'
          ? 'Barang ini belum kamu punya.'
          : 'Pilihannya nggak kebaca. Coba lagi ya.',
        409,
      )
    }

    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
