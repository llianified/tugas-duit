import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { query } from './db'
import { env } from './env'

const COOKIE_NAME = 'td_session'
const hashToken = (token: string) => createHash('sha256').update(token).digest()

/**
 * Aplikasi ini selalu hidup di dalam iframe pihak ketiga — Telegram WebApp maupun
 * preview v0. Chrome sudah memblokir cookie pihak ketiga yang tak berpartisi, jadi
 * `SameSite=None; Secure` saja tidak cukup lagi: cookie ikut terkirim di respons,
 * tapi browser membuangnya, dan `/api/session` selalu balik `user: null` ("Kami belum
 * kenal sesi kamu"). `Partitioned` (CHIPS) menitipkan cookie ke partisi milik situs
 * induk sehingga tetap tersimpan dan terkirim. Atribut ini harus sama persis saat
 * cookie dihapus, kalau tidak yang terhapus adalah cookie lain.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  partitioned: true,
  path: '/',
} as const

interface SessionUser {
  id: number
  publicId: string
  telegramId: string
  firstName: string
  username: string | null
  photoUrl: string | null
  balanceCredits: number
  referralCode: string
  bannedAt: Date | null
  isAdmin: boolean
  premiumUntil: Date | null
  channelBonusClaimedAt: Date | null
  channelMember: boolean | null
  channelCheckedAt: Date | null
}

export class UnauthorizedError extends Error {}
export class BannedError extends Error {}

export async function createSession(userId: number, userAgent: string | null) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 30 * 86_400_000)
  await query(
    `insert into sessions(user_id, token_hash, expires_at, user_agent) values($1,$2,$3,$4)`,
    [userId, hashToken(token), expiresAt, userAgent],
  )
  await query(
    `update sessions set revoked_at=now() where id in (select id from sessions where user_id=$1 and revoked_at is null order by created_at desc offset 5)`,
    [userId],
  )
  ;(await cookies()).set(COOKIE_NAME, token, { ...COOKIE_OPTIONS, expires: expiresAt })
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null
  const rows = await query<{
    id: string
    public_id: string
    telegram_id: string
    first_name: string
    username: string | null
    photo_url: string | null
    balance_credits: string
    referral_code: string
    banned_at: Date | null
    is_admin: boolean
    premium_until: Date | null
    channel_bonus_claimed_at: Date | null
    channel_member: boolean | null
    channel_checked_at: Date | null
  }>(
    `update sessions s set last_seen_at=now() from users u where s.token_hash=$1 and s.user_id=u.id and s.revoked_at is null and s.expires_at>now() returning u.id,u.public_id,u.telegram_id,u.first_name,u.username,u.photo_url,u.balance_credits,u.referral_code,u.banned_at,u.is_admin,u.premium_until,u.channel_bonus_claimed_at,u.channel_member,u.channel_checked_at`,
    [hashToken(token)],
  )
  const row = rows[0]
  return row
    ? {
        id: Number(row.id),
        publicId: row.public_id,
        telegramId: row.telegram_id,
        firstName: row.first_name,
        username: row.username,
        photoUrl: row.photo_url,
        balanceCredits: Number(row.balance_credits),
        referralCode: row.referral_code,
        bannedAt: row.banned_at,
        isAdmin: isAdminUser(row.telegram_id, row.is_admin),
        premiumUntil: row.premium_until,
        channelBonusClaimedAt: row.channel_bonus_claimed_at,
        channelMember: row.channel_member,
        channelCheckedAt: row.channel_checked_at,
      }
    : null
}

function isAdminUser(telegramId: string, flag: boolean): boolean {
  if (flag) return true
  const configured = env.adminTelegramIdOrNull
  return configured !== null && telegramId === configured
}

export async function requireUser() {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError()
  if (user.bannedAt) throw new BannedError()
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (!user.isAdmin) throw new UnauthorizedError()
  return user
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (token) {
    await query('update sessions set revoked_at=now() where token_hash=$1', [hashToken(token)])
  }
  jar.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}
