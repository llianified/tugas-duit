import { loadEconomyConfig } from '@/server/economy-config'
import { startChallenge } from '@/server/challenge'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/http'
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
    const limit = await checkRateLimit(`task:start:${user.id}`, 30, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    const body = (await request.json()) as { challengeId?: string }
    const started = await startChallenge(user.id, body.challengeId ?? '')
    if (!started.ok) {
      if (started.reason === 'energy_empty')
        return Response.json(
          {
            error: {
              code: 'ENERGY_EMPTY',
              message: 'Energi kamu habis. Tunggu energi berikutnya ya.',
            },
            energy: started.energy,
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } },
        )
      if (started.reason === 'pool_empty')
        return apiError(
          'REWARD_POOL_EMPTY',
          'Kolam reward kamu kosong. Tunggu terisi lagi ya, energi kamu tidak terpakai.',
          409,
        )
      return apiError('CHALLENGE_NOT_STARTABLE', 'Soalnya nggak bisa dimulai. Ambil soal baru ya.', 409)
    }
    return Response.json(
      { challenge: started.challenge, elapsedMs: started.elapsedMs, energy: started.energy },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
