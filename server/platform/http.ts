import { isIP } from 'node:net'
import { env } from './env'
import { BannedError, UnauthorizedError } from '../auth/session'
import { RateLimitedError } from './ratelimit'

export function apiError(code: string, message: string, status: number, fields?: Record<string, string | null>) {
  return Response.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

let warnedMissingAppOrigin = false
function warnMissingAppOrigin(): void {
  if (warnedMissingAppOrigin) return
  warnedMissingAppOrigin = true
  console.warn(
    '[http] APP_ORIGIN belum diset di produksi. Cek origin jatuh ke perbandingan Origin vs host request; setel APP_ORIGIN untuk allowlist eksplisit.',
  )
}

export function assertSameOrigin(request: Request): Response | null {
  if (request.method === 'GET' || request.method === 'HEAD') return null

  const suppliedOrigin = normalizedOrigin(request.headers.get('origin') ?? '')
  const configuredOrigin = normalizedOrigin(env.appOriginOrNull ?? '')
  if (!configuredOrigin && process.env.NODE_ENV === 'production') warnMissingAppOrigin()
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const forwardedProto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    new URL(request.url).protocol.replace(':', '')
  const requestOrigin = forwardedHost
    ? normalizedOrigin(`${forwardedProto}://${forwardedHost}`)
    : normalizedOrigin(request.url)

  const secFetchSite = request.headers.get('sec-fetch-site')
  const sameOriginByBrowser = secFetchSite === 'same-origin' || secFetchSite === 'none'

  const allowed =
    sameOriginByBrowser ||
    Boolean(
      suppliedOrigin &&
        (suppliedOrigin === configuredOrigin || suppliedOrigin === requestOrigin),
    )

  return allowed ? null : apiError('FORBIDDEN_ORIGIN', 'Buka Tugas Duit dari Telegram ya.', 403)
}

export function assertNotCrossSite(request: Request): Response | null {
  const site = request.headers.get('sec-fetch-site')
  if (site === 'cross-site' || site === 'same-site') {
    return apiError('FORBIDDEN_ORIGIN', 'Buka Tugas Duit dari Telegram ya.', 403)
  }
  return null
}

export function rateLimited(retryAfter: number): Response {
  return Response.json(
    { error: { code: 'RATE_LIMITED', message: 'Kecepetan nih. Tunggu sebentar ya.' } },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}

/** Render berada pada hop terminal rantai `x-forwarded-for`, sedangkan nilai di sebelah kiri dapat
 * berasal dari pemanggil. Rate limit hanya memakai alamat terminal yang valid; header kosong atau
 * rusak masuk bucket bersama agar nilai yang tidak tepercaya tidak menjadi key arbitrer. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  const candidate = forwarded.split(',').at(-1)?.trim() ?? ''
  if (!candidate) return 'unknown'
  return isIP(candidate) ? candidate.toLowerCase() : 'malformed'
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof UnauthorizedError) return apiError('UNAUTHORIZED', 'Kamu perlu masuk lagi ya.', 401)
  if (error instanceof BannedError) return apiError('ACCOUNT_SUSPENDED', 'Akun kamu lagi dibekukan.', 403)
  if (error instanceof RateLimitedError) return rateLimited(error.retryAfter)
  console.error('[api] error tak tertangani:', error)
  return apiError('INTERNAL', 'Lagi ada gangguan. Coba lagi ya.', 500)
}

const MAX_UNAUTHENTICATED_BODY_BYTES = 16 * 1024

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_UNAUTHENTICATED_BODY_BYTES) return null
  try {
    const text = await request.text()
    if (text.length === 0 || text.length > MAX_UNAUTHENTICATED_BODY_BYTES) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
