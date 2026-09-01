import { assertSameOrigin, handleRouteError, rateLimited } from '@/server/http'
import { runMaintenance } from '@/server/maintenance'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Menjalankan pemeliharaan dari panel, isinya persis sama dengan yang dipicu cron harian
 * (`/api/cron/maintenance`) dan `pnpm db:cleanup`.
 *
 * Route ini terpisah dari yang dipakai cron karena penjagaannya berbeda dan tidak boleh
 * dicampur: yang itu dijaga `CRON_SECRET` dan sengaja tidak tahu siapa pemanggilnya, yang
 * ini dijaga sesi admin. Menambahkan jalur sesi ke route cron akan memberi dua kunci
 * berbeda pada satu pintu, dan yang paling longgar yang menentukan.
 *
 * Plafonnya ketat: pemeliharaan menyapu tabel besar dan mengirim pesan bot, jadi menekannya
 * berkali-kali tidak membantu apa pun.
 */
export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:maintenance:${admin.id}`, 6, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

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
