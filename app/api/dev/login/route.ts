import { isPreviewDb, query } from '@/server/platform/db'
import { assertSameOrigin, clientIp, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { generateReferralCode } from '@/server/economy/referral'
import { createSession, previewSessionToken } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEV_TELEGRAM_ID = 900_000_000_000_001
const DEV_FIRST_NAME = 'Preview'
const DEV_USERNAME = 'preview_dev'

export async function POST(request: Request) {
  if (!isPreviewDb()) {
    return new Response(null, { status: 404 })
  }
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    const limit = await checkRateLimit(`dev-login:${clientIp(request)}`, 20, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    const rows = await query<{ id: string; banned_at: Date | null }>(
      `insert into users(telegram_id,username,first_name,referral_code,is_admin)
       values($1,$2,$3,$4,true)
       on conflict(telegram_id) do update set updated_at=now(),is_admin=true
       returning id,banned_at`,
      [DEV_TELEGRAM_ID, DEV_USERNAME, DEV_FIRST_NAME, generateReferralCode()],
    )
    const user = rows[0]
    if (user.banned_at) return new Response(null, { status: 403 })

    const token = await createSession(Number(user.id), 'dev-preview')
    /** Token dikembalikan ke klien supaya preview tetap punya sesi walau cookie-nya dibuang browser — preview selalu dibingkai situs lain, jadi cookie sesinya adalah cookie pihak ketiga. Route ini sudah 404 kalau bukan preview (`isPreviewDb()` di atas), dan `previewSessionToken` menolak lagi di produksi, jadi tidak ada jalan token ini bocor ke deploy sungguhan. */
    return Response.json({ token: previewSessionToken(token) })
  } catch (error) {
    return handleRouteError(error)
  }
}
