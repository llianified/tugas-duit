import { channelGateBlocks } from '@/server/integrations/channel'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { startChallenge, type TaskPayment } from '@/server/task/challenge'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

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
    if (await channelGateBlocks(user)) {
      return apiError(
        'CHANNEL_REQUIRED',
        'Join channel Telegram dulu sebelum mulai task.',
        403,
      )
    }
    const body = (await request.json().catch(() => null)) as {
      challengeId?: string
      payWith?: string
    } | null
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Datanya nggak kebaca. Coba lagi ya.', 400)
    }
    const payWith: TaskPayment = body.payWith === 'ad' ? 'ad' : 'energy'
    const started = await startChallenge(user.id, body.challengeId ?? '', payWith)
    if (!started.ok) {
      if (started.reason === 'energy_empty')
        return Response.json(
          {
            error: {
              code: 'ENERGY_EMPTY',
              message: 'Energi habis. Tunggu isi berikutnya.',
            },
            energy: started.energy,
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } },
        )
      if (started.reason === 'ad_pass_missing')
        return apiError(
          'AD_PASS_MISSING',
          'Tiket iklan kedaluwarsa. Tonton lagi.',
          409,
        )
      if (started.reason === 'pool_empty')
        return apiError(
          'REWARD_POOL_EMPTY',
          'Stok reward kosong. Energi tetap aman.',
          409,
        )
      return apiError('CHALLENGE_NOT_STARTABLE', 'Soal gagal dimulai. Ambil soal baru.', 409)
    }
    return Response.json(
      {
        challenge: started.challenge,
        elapsedMs: started.elapsedMs,
        energy: started.energy,
        paidBy: started.paidBy,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
