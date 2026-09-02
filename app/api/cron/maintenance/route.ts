import { env } from '@/server/env'
import { apiError, handleRouteError } from '@/server/http'
import { runMaintenance } from '@/server/maintenance'
import { matchesSecret } from '@/server/secret'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Pengganti cron Railway (`pnpm db:cleanup` tiap jam) setelah pindah ke Vercel, yang memicu pekerjaan terjadwal lewat HTTP, bukan proses terpisah. Vercel Cron mengirim `Authorization: Bearer $CRON_SECRET`. Bentuk yang sama dipakai pemicu eksternal, jadi route ini tidak perlu tahu siapa yang memanggilnya — plan Hobby membatasi cron bawaan ke sekali sehari, sedangkan `rate_limits` menumpuk per jam, jadi pemicu luar memang jalur yang wajar di sana. Tanpa CRON_SECRET route ini menolak semua orang, bukan membuka diri: kalau env-nya belum diset, yang benar adalah cron tidak jalan, bukan siapa pun bisa memicunya. */
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
