import { getActivityFeed } from '@/server/task/activity'
import { leaderboardEnabled } from '@/features/leaderboard/availability'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await loadEconomyConfig()
    /** Umpan ini bagian dari view Peringkat, jadi ia ikut mati bersamanya — bentuk yang sama dengan `/api/leaderboard`. Deskripsi `leaderboardEnabled` di panel menyebut "view Peringkat beserta umpan aktivitasnya" sebagai satu saklar; tanpa baris ini separuhnya tetap menyala. */
    if (!leaderboardEnabled()) return new Response('Not Found', { status: 404 })

    const user = await requireUser()
    /** 200, bukan 120: klien memoll tiap `ACTIVITY_POLL_MS` (30 detik = 120 permintaan per jam) dan sisanya jatah untuk `revalidateOnFocus` serta pemasangan ulang komponen. Plafon yang persis sama dengan laju pollingnya tidak menyisakan apa pun, dan itu yang membuat umpannya mati diam-diam di setengah jam pertama. Dijaga `tests/rate-budget.test.ts`. */
    const limit = await checkRateLimit(`activity:${user.id}`, 200, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    return Response.json(
      { entries: await getActivityFeed() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
