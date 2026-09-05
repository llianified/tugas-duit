import { loadEconomyConfig } from '@/server/economy/economy-config'
import { issueChallenge, submitAnswer } from '@/server/task/challenge'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'
import { getStats } from '@/server/task/stats'

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

    const body = (await request.json().catch(() => null)) as {
      challengeId?: string
      answer?: string
    } | null
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Datanya nggak kebaca. Coba lagi ya.', 400)
    }

    const result = await submitAnswer(user.id, body.challengeId ?? '', body.answer ?? '')
    if (result.ok) {
      /** Statistik dan soal berikutnya dititipkan di respons ini supaya klien tidak menembak
       * `/api/stats` dan `/api/task` lagi untuk hal yang sama — dua dari lima penyegaran yang dulu
       * mengekor tiap jawaban benar. Keduanya SESUDAH transaksinya commit dan sengaja best-effort:
       * pembayarannya sudah tercatat sebelum baris ini, jadi kegagalan di sini tidak boleh
       * menjatuhkan respons yang membawa saldo barunya. `null` adalah jalur mundurnya — klien
       * menyegarkan sendiri persis seperti sebelumnya. `issueChallenge` aman dipanggil dua kali:
       * ia mengembalikan soal aktif yang sudah ada sebelum membuat yang baru. */
      const [stats, challenge] = await Promise.all([
        getStats(user.id, result.balance).catch(() => null),
        issueChallenge(user.id).catch(() => null),
      ])
      return Response.json(
        { ...result, stats, challenge },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (result.reason === 'daily_task_cap') {
      return apiError(
        'DAILY_TASK_LIMIT',
        'Jatah soal hari ini udah habis. Ongkosnya balik lagi kok. Coba lagi besok ya.',
        429,
      )
    }
    if (result.reason === 'pool_empty') {
      return apiError(
        'REWARD_POOL_EMPTY',
        'Stok reward kosong. Biayanya dikembalikan. Tunggu stok terisi.',
        429,
      )
    }
    if (result.reason === 'not_found') {
      return apiError('CHALLENGE_NOT_FOUND', 'Soalnya udah nggak ada. Ambil soal baru ya.', 404)
    }
    if (result.reason === 'not_started') {
      return apiError('CHALLENGE_NOT_STARTED', 'Soalnya belum dimulai. Ambil soal baru ya.', 409)
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
