import { loginAdminWithPassword, type AdminLoginFailure } from '@/server/auth/admin-auth'
import { env } from '@/server/platform/env'
import { apiError, assertSameOrigin, clientIp, handleRouteError, rateLimited, readJsonBody } from '@/server/platform/http'
import { notifyAdminLogin, notifyAdminLoginFlood } from '@/server/messaging/notify'
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
const FLOOD_NOTICE_BUCKET = 'admin-login-flood-notice'

/** Rem darurat terhadap brute force yang tersebar di banyak IP — dan hanya itu. Ia berdiri
 * SESUDAH sandi diverifikasi, karena ember global adalah satu-satunya penghitung di sini yang
 * bisa diisi orang lain: ±25 IP yang masing-masing berhenti di bawah plafon per-IP sudah cukup
 * menutup pintu masuk admin selama sisa jam itu, dan bersamanya pemrosesan payout ikut berhenti.
 * Sandi yang benar tidak pernah menyentuh penghitung ini.
 *
 * Tetap lewat `recordRateLimitHit` + `peekRateLimit`, bukan `checkRateLimit`: sejak reservasi
 * token masuk, `checkRateLimit` membelanjakan izin borongan dari memori proses, dan itu benar
 * untuk bucket yang berkunci per pemakai — bukan untuk satu-satunya ember di aplikasi ini yang
 * memang GLOBAL. Penghitung brute force harus eksak dan tidak boleh dilayani dari cache instance.
 *
 * Penuhnya ember juga tidak boleh diam: satu pesan per jam ke pemilik, karena penguncian tanpa
 * kabar adalah kegagalan yang tidak berbunyi. Ember pemberitahuannya berplafon 1, jauh di bawah
 * `LEASE_MIN_LIMIT`, jadi ia dihitung eksak juga. */
async function brakeAfterWrongPassword(ip: string, userAgent: string | null) {
  await recordRateLimitHit(`${FAILURE_BUCKET}:${ip}`, 3_600)
  await recordRateLimitHit(FAILURE_BUCKET, 3_600)
  const global = await peekRateLimit(FAILURE_BUCKET, FAILURE_LIMIT, 3_600)
  if (global.allowed) return null

  const notice = await checkRateLimit(FLOOD_NOTICE_BUCKET, 1, 3_600)
  const owner = env.adminTelegramIdOrNull
  if (notice.allowed && owner) {
    await notifyAdminLoginFlood({ telegramId: owner, failures: FAILURE_LIMIT, ip, userAgent })
  }
  return rateLimited(global.retryAfter)
}

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

    const body = await readJsonBody<{ password?: unknown }>(request)
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!password || password.length > PASSWORD_MAX) {
      return apiError('VALIDATION_FAILED', 'Kata sandi wajib diisi.', 400)
    }

    const result = await loginAdminWithPassword(password, userAgent)
    if (!result.ok) {
      if (result.reason === 'INVALID_PASSWORD') {
        const braked = await brakeAfterWrongPassword(ip, userAgent)
        if (braked) return braked
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
