import { isPreviewDb, query } from '@/server/db'
import { assertSameOrigin, clientIp, handleRouteError, rateLimited } from '@/server/http'
import { checkRateLimit } from '@/server/ratelimit'
import { generateReferralCode } from '@/server/referral'
import { createSession } from '@/server/session'

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
      `insert into users(telegram_id,username,first_name,referral_code)
       values($1,$2,$3,$4)
       on conflict(telegram_id) do update set updated_at=now()
       returning id,banned_at`,
      [DEV_TELEGRAM_ID, DEV_USERNAME, DEV_FIRST_NAME, generateReferralCode()],
    )
    const user = rows[0]
    if (user.banned_at) return new Response(null, { status: 403 })

    await createSession(Number(user.id), 'dev-preview')
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
