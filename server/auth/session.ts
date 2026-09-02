import { createHash, randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { isPreviewShell, query } from '../platform/db'
import { env } from '../platform/env'

const COOKIE_NAME = 'td_session'

/** Jalur cadangan KHUSUS preview, dan hanya aktif saat `isPreviewShell()` — yaitu NODE_ENV bukan production, tidak ada DATABASE_URL, dan bukan proses `pnpm test`. Di produksi header ini tidak pernah dibaca, jadi tidak ada cara memakai token sesi dari JavaScript. Di tes juga tidak, supaya suite tetap membuktikan bahwa cookie sendirian cukup untuk membawa sesi. Alasannya: preview selalu tampil di dalam iframe milik situs lain, dan cookie sesinya jadi cookie pihak ketiga. `Partitioned` (CHIPS) memperbaikinya di Chrome modern, tapi tidak di Safari/Firefox dan tidak saat user memblokir cookie pihak ketiga sepenuhnya — di sana cookie apa pun yang dikirim server dibuang tanpa suara, dan satu-satunya gejalanya adalah "Kami belum kenal sesi kamu" yang tidak bisa dilewati. Header tidak lewat cookie jar, jadi ia lolos dari semua aturan itu. */
const HEADER_NAME = 'x-td-session'
const hashToken = (token: string) => createHash('sha256').update(token).digest()

/** Token mentah dikembalikan supaya `/api/dev/login` bisa menyerahkannya ke klien preview. Null di produksi: di sana cookie adalah satu-satunya pembawa sesi. */
export function previewSessionToken(token: string): string | null {
  return isPreviewShell() ? token : null
}

async function readSessionToken(): Promise<string | null> {
  const cookieToken = (await cookies()).get(COOKIE_NAME)?.value
  if (cookieToken) return cookieToken
  if (!isPreviewShell()) return null
  return (await headers()).get(HEADER_NAME)?.trim() || null
}

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
  /** `sameSite: 'none'` saja TIDAK cukup lagi. App ini selalu dijalankan di dalam iframe milik situs lain — preview v0 (`v0.app` membingkai `*.vusercontent.net`) dan Telegram Web (`web.telegram.org`) — jadi cookie sesi ini adalah cookie pihak ketiga. Chrome (dan Safari sejak lama) MEMBUANG cookie pihak ketiga yang tidak dipartisi, sehingga `POST /api/dev/login` sukses 204 tapi `GET /api/session` berikutnya datang tanpa cookie: `user: null`, dan layarnya berhenti di "Kami belum kenal sesi kamu". `partitioned: true` (CHIPS) meminta cookie yang tetap dikirim di dalam iframe, dengan jar terpisah per situs induk. Syaratnya `Secure` + `SameSite=None`, yang keduanya sudah dipakai di sini. Browser lama mengabaikan atribut yang tidak dikenalnya, jadi perilaku sebelumnya tidak berubah di sana. Konsekuensi yang disengaja: sesi tidak lagi dibagi antar situs induk yang berbeda (mis. preview v0 dan Telegram Web punya sesi masing-masing). Itu tidak merugikan — setiap pembukaan memang login ulang lewat `initData` atau `/api/dev/login`. */
  ;(await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    expires: expiresAt,
  })
  return token
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readSessionToken()
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
  const token = await readSessionToken()
  if (token) {
    await query('update sessions set revoked_at=now() where token_hash=$1', [hashToken(token)])
  }
  /** Atributnya harus sama dengan saat ditulis. Cookie berpartisi punya kunci yang berbeda dari cookie biasa dengan nama yang sama, jadi `delete(COOKIE_NAME)` polos mengirim Set-Cookie tanpa `Partitioned` dan browser membiarkan yang asli hidup. */
  jar.delete({ name: COOKIE_NAME, path: '/', secure: true, sameSite: 'none', partitioned: true })
}
