import { env } from '@/server/platform/env'
import { apiError, handleRouteError } from '@/server/platform/http'
import { runMaintenance } from '@/server/ops/maintenance'
import { matchesSecret } from '@/server/platform/secret'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GitHub Actions memanggil endpoint ini sesuai jadwal dan membawa `Authorization: Bearer $CRON_SECRET`. Route sengaja tidak bergantung pada identitas pemicu; tanpa rahasia yang dikonfigurasi ia menolak semua pemanggil. */
export async function GET(request: Request) {
  try {
    const expected = env.cronSecretOrNull
    if (!expected) {
      console.error('[cron] CRON_SECRET belum diset — permintaan ditolak.')
      return apiError('CRON_NOT_CONFIGURED', 'Cron belum dikonfigurasi.', 503)
    }

    const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
    if (!supplied || !matchesSecret(supplied, expected)) {
      return apiError('UNAUTHORIZED', 'Tidak dikenal.', 401)
    }

    const started = Date.now()
    const summary = await runMaintenance()
    return Response.json(
      { ok: true, durationMs: Date.now() - started, ...summary },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
