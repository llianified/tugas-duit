import { loadEconomyConfig } from '@/server/economy-config'
import { submitAnswer } from '@/server/challenge'
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
    const limit = await checkRateLimit(`task:submit:${user.id}`, 30, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = (await request.json()) as { challengeId?: string; answer?: string }
    const result = await submitAnswer(user.id, body.challengeId ?? '', body.answer ?? '')
    if (result.ok) return Response.json(result)

    if (result.reason === 'pool_empty') {
      return apiError(
        'REWARD_POOL_EMPTY',
        'Kolam reward kamu kosong. Energi kamu dikembalikan, tunggu kolamnya terisi lagi ya.',
        429,
      )
    }
    if (result.reason === 'not_found') {
      return apiError('CHALLENGE_NOT_FOUND', 'Soalnya udah nggak ada. Ambil soal baru ya.', 404)
    }
    if (result.reason === 'not_started') {
      return apiError('CHALLENGE_NOT_STARTED', 'Task-nya belum dimulai. Ambil soal baru ya.', 409)
    }
    if (result.reason === 'expired') {
      return apiError('CHALLENGE_EXPIRED', 'Waktunya habis. Ambil soal baru ya.', 410)
    }
    if (result.reason === 'already_submitted') {
      return apiError(
        'CHALLENGE_ALREADY_SUBMITTED',
        'Soal ini udah kamu kirim. Ambil soal baru ya.',
        409,
      )
    }
    if (result.reason === 'too_many_attempts') {
      return apiError('TOO_MANY_ATTEMPTS', 'Percobaan kamu udah habis. Ambil soal baru ya.', 410)
    }
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
