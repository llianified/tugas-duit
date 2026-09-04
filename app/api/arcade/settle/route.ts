import { loadEconomyConfig } from '@/server/economy/economy-config'
import {
  apiError,
  assertSameOrigin,
  handleRouteError,
  rateLimited,
  readJsonBody,
} from '@/server/platform/http'
import { settleArcadePlay } from '@/server/arcade/arcade'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFUSAL: Record<string, { message: string; status: number }> = {
  unknown_play: { message: 'Rondenya nggak ketemu.', status: 409 },
  /** Yang balik cuma tiket iklannya. Jatah main harian sengaja tidak pernah dikembalikan — `plays_today` menghitung ronde yang DIBUKA — jadi kalimat lama yang menjanjikan "jatahnya balik" salah menyebut dua hal sekaligus. */
  play_expired: {
    message: 'Rondenya kelamaan ditinggal. Tiket iklannya balik, tapi jatah main hari ini tetap terpakai.',
    status: 409,
  },
  bad_pick: { message: 'Kotaknya nggak valid.', status: 400 },
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`arcade:settle:${user.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{ playId?: unknown; pick?: unknown; won?: unknown }>(request)
    const settled = await settleArcadePlay(user.id, {
      playId: typeof body?.playId === 'string' ? body.playId : '',
      pick: typeof body?.pick === 'number' ? body.pick : undefined,
      won: body?.won === true,
    })
    if (!settled.ok) {
      const refusal = REFUSAL[settled.reason]
      return apiError('ARCADE_SETTLE_REFUSED', refusal.message, refusal.status)
    }

    return Response.json(settled, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
