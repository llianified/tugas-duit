import { loadEconomyConfig } from '@/server/economy/economy-config'
import {
  apiError,
  assertSameOrigin,
  handleRouteError,
  rateLimited,
  readJsonBody,
} from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { startMissionAction } from '@/server/task/missions'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFUSAL = {
  unknown_mission: { message: 'Misinya nggak ketemu. Muat ulang dulu ya.', status: 400 },
  already_claimed: { message: 'Hadiah misi ini udah kamu ambil.', status: 409 },
} as const

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`missions:start:${user.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{ key?: unknown }>(request)
    const key = typeof body?.key === 'string' ? body.key : ''
    const started = await startMissionAction(user.id, key)
    if (!started.ok) {
      const refusal = REFUSAL[started.reason]
      return apiError('MISSION_ACTION_REFUSED', refusal.message, refusal.status)
    }

    return Response.json(started, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
