import { ECONOMY_FIELDS } from '@/domain/economy/economy-config'
import {
  EconomyConfigError,
  readEconomyAudit,
  readEconomyConfigSnapshot,
  updateEconomyConfig,
} from '@/server/economy/economy-config'
import { apiError, assertSameOrigin, handleRouteError, rateLimited, readJsonBody } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MESSAGE: Record<string, string> = {
  ECONOMY_CONFIG_INVALID: 'Ada nilai yang tidak valid.',
  ECONOMY_CONFIG_CONFLICT:
    'Konfigurasi sudah berubah sejak halaman ini dibuka. Muat ulang, lalu terapkan lagi.',
  ECONOMY_CONFIG_FORBIDDEN: 'Tidak punya hak mengubah konfigurasi ekonomi.',
  ECONOMY_CONFIG_MISSING: 'Konfigurasi ekonomi belum ada di database.',
}

function fail(error: unknown) {
  if (error instanceof EconomyConfigError) {
    return apiError(
      error.code,
      MESSAGE[error.code] ?? 'Konfigurasi tidak bisa diproses.',
      error.status,
      error.errors as Record<string, string | null> | undefined,
    )
  }
  return handleRouteError(error)
}

export async function GET() {
  try {
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:economy:${admin.id}`, 300, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    const [snapshot, audit] = await Promise.all([readEconomyConfigSnapshot(), readEconomyAudit()])
    return Response.json({ ...snapshot, audit, fields: ECONOMY_FIELDS })
  } catch (error) {
    return fail(error)
  }
}

export async function PATCH(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:economy-write:${admin.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{ config?: unknown; version?: unknown }>(request)
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Data yang dikirim nggak kebaca.', 400)
    }
    if (typeof body.version !== 'number' || !Number.isInteger(body.version)) {
      return apiError('VALIDATION_FAILED', 'Versi konfigurasi wajib disertakan.', 400)
    }

    const result = await updateEconomyConfig(admin.id, body.config, body.version)
    return Response.json(result)
  } catch (error) {
    return fail(error)
  }
}
