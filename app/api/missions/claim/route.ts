import { loadEconomyConfig } from '@/server/economy/economy-config'
import {
  apiError,
  assertSameOrigin,
  handleRouteError,
  rateLimited,
  readJsonBody,
} from '@/server/platform/http'
import { claimMission } from '@/server/task/missions'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFUSAL: Record<string, { message: string; status: number }> = {
  unknown_mission: { message: 'Misinya nggak ketemu. Muat ulang dulu ya.', status: 400 },
  not_done: { message: 'Misinya belum kelar. Lanjut dulu ya.', status: 409 },
  already_claimed: { message: 'Hadiah misi ini udah kamu ambil hari ini.', status: 409 },
  energy_full: {
    message: 'Energi bakal kelebihan. Pakai dulu, lalu klaim.',
    status: 409,
  },
  action_required: {
    message: 'Buka dulu aksi sosialnya sebelum konfirmasi.',
    status: 409,
  },
  action_cooldown: {
    message: 'Tunggu hitung mundurnya selesai sebelum konfirmasi.',
    status: 409,
  },
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`missions:claim:${user.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{ key?: unknown }>(request)
    const key = typeof body?.key === 'string' ? body.key : ''

    const claimed = await claimMission(user.id, key)
    if (!claimed.ok) {
      const refusal = REFUSAL[claimed.reason]
      return apiError('MISSION_CLAIM_REFUSED', refusal.message, refusal.status)
    }

    return Response.json(claimed, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
