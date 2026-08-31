import type { PoolClient } from 'pg'
import { transaction } from '@/server/db'
import { assertSameOrigin, apiError, clientIp, handleRouteError, rateLimited, readJsonBody } from '@/server/http'
import { checkRateLimit } from '@/server/ratelimit'
import { createSession } from '@/server/session'
import { claimInitData, verifyInitData } from '@/server/telegram'
import { bindUpline, generateReferralCode } from '@/server/referral'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CODE_ATTEMPTS = 4

async function upsertUser(tx: PoolClient, tg: { id: number; username?: string; first_name?: string; photo_url?: string }) {
  const inserted = await tx.query<{ id: string; is_new: boolean; banned_at: Date | null }>(
    `insert into users(telegram_id,username,first_name,photo_url,referral_code)
     values($1,$2,$3,$4,$5)
     on conflict(telegram_id) do update set
       username=case when users.profile_overridden_at is null then excluded.username else users.username end,
       first_name=case when users.profile_overridden_at is null then excluded.first_name else users.first_name end,
       photo_url=case when users.profile_overridden_at is null then excluded.photo_url else users.photo_url end,
       updated_at=now()
     returning id,(xmax=0) is_new,banned_at`,
    [tg.id, tg.username ?? null, tg.first_name ?? '', tg.photo_url ?? null, generateReferralCode()],
  )
  return {
    id: Number(inserted.rows[0].id),
    isNew: inserted.rows[0].is_new,
    bannedAt: inserted.rows[0].banned_at,
  }
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    const limit = await checkRateLimit(`auth:${clientIp(request)}`, 20, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    const body = await readJsonBody<{ initData?: string }>(request)
    const verified = verifyInitData(typeof body?.initData === 'string' ? body.initData : '')
    if (!verified.ok) {
      return apiError(verified.reason === 'expired' ? 'INIT_DATA_EXPIRED' : 'INVALID_INIT_DATA', 'Datanya nggak cocok. Coba buka ulang dari Telegram ya.', 401)
    }
    const tg = verified.user

    const identityLimit = await checkRateLimit(`auth:tg:${tg.id}`, 60, 3600)
    if (!identityLimit.allowed) return rateLimited(identityLimit.retryAfter)

    if (!(await claimInitData(verified.hash, verified.authDate))) {
      return apiError('INIT_DATA_EXPIRED', 'Datanya nggak cocok. Coba buka ulang dari Telegram ya.', 401)
    }

    let user: { id: number; isNew: boolean; bannedAt: Date | null } | null = null
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      try {
        user = await transaction(async (tx) => {
          const upserted = await upsertUser(tx, tg)
          if (upserted.isNew) await bindUpline(tx, { userId: upserted.id, code: verified.startParam })
          return upserted
        })
        break
      } catch (error) {
        if ((error as { code?: string }).code !== '23505' || attempt === CODE_ATTEMPTS - 1) throw error
      }
    }
    if (!user) throw new Error('Kode referral gagal dibuat')
    if (user.bannedAt) {
      return apiError('ACCOUNT_SUSPENDED', 'Akun kamu lagi dibekukan.', 403)
    }

    await createSession(user.id, request.headers.get('user-agent'))
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
