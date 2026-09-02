import { loginAdminWithPassword, type AdminLoginFailure } from '@/server/auth/admin-auth'
import { env } from '@/server/platform/env'
import { apiError, assertSameOrigin, clientIp, handleRouteError, rateLimited, readJsonBody } from '@/server/platform/http'
import { notifyAdminLogin } from '@/server/messaging/notify'
import { checkRateLimit, peekRateLimit, recordRateLimitHit } from '@/server/platform/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PASSWORD_MAX = 200

const FAILURE: Record<AdminLoginFailure, { status: number; message: string }> = {
  NOT_CONFIGURED: {
    status: 503,
    message: 'Login admin belum dikonfigurasi di server.',
  },
  INVALID_PASSWORD: { status: 401, message: 'Kata sandi salah.' },
  UNKNOWN_ADMIN: {
    status: 409,
    message:
      'Akun admin belum terdaftar. Buka Mini App dari Telegram satu kali dengan akun tersebut, lalu coba lagi.',
  },
  BANNED: { status: 403, message: 'Akun admin sedang ditangguhkan.' },
}

const FAILURE_BUCKET = 'admin-login-failures'
const FAILURE_LIMIT = 500
const FAILURE_PER_IP_LIMIT = 20

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  const ip = clientIp(request)
  const userAgent = request.headers.get('user-agent')
  try {
    const perIp = await checkRateLimit(`admin-login:${ip}`, 10, 600)
    if (!perIp.allowed) return rateLimited(perIp.retryAfter)
    const failuresFromIp = await peekRateLimit(`${FAILURE_BUCKET}:${ip}`, FAILURE_PER_IP_LIMIT, 3_600)
    if (!failuresFromIp.allowed) return rateLimited(failuresFromIp.retryAfter)
    const failures = await peekRateLimit(FAILURE_BUCKET, FAILURE_LIMIT, 3_600)
    if (!failures.allowed) return rateLimited(failures.retryAfter)

    const body = await readJsonBody<{ password?: unknown }>(request)
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!password || password.length > PASSWORD_MAX) {
      return apiError('VALIDATION_FAILED', 'Kata sandi wajib diisi.', 400)
    }

    const result = await loginAdminWithPassword(password, userAgent)
    if (!result.ok) {
      if (result.reason === 'INVALID_PASSWORD') {
        await recordRateLimitHit(`${FAILURE_BUCKET}:${ip}`, 3_600)
        await recordRateLimitHit(FAILURE_BUCKET, 3_600)
      }
      console.warn('[admin-login] gagal (%s) dari %s — %s', result.reason, ip, userAgent ?? 'ua tidak diketahui')
      const failure = FAILURE[result.reason]
      return apiError(result.reason, failure.message, failure.status)
    }

    console.info('[admin-login] berhasil dari %s — %s', ip, userAgent ?? 'ua tidak diketahui')
    const owner = env.adminTelegramIdOrNull
    if (owner) await notifyAdminLogin({ telegramId: owner, ip, userAgent })

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
