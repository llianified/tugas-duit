import { createHash, randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { isPreviewShell, query } from '../platform/db'
import { env } from '../platform/env'
import { enforceRateLimit } from '../platform/ratelimit'

const COOKIE_NAME = 'td_session'

// Jalur header hanya menolong iframe preview yang kehilangan cookie pihak ketiga.
// Batas keamanan dan alasan atribut cookie: docs/adr/0002-sesi-di-iframe.md.
const HEADER_NAME = 'x-td-session'
const hashToken = (token: string) => createHash('sha256').update(token).digest()

/** Mengembalikan token mentah hanya agar klien preview dapat memakai pembawa cadangan. */
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
  /** Sampai kapan Pass Gaspol berlaku. Ikut dibaca di sini, bukan lewat kueri sendiri, karena
   * setiap pemuatan sesi membutuhkannya: klien harus tahu bahwa soal sedang tidak memotong energi,
   * kalau tidak tombol mulainya mati sendiri saat energi habis — persis pada user yang baru saja
   * membayar supaya energinya tidak lagi jadi penghalang. */
  gaspolUntil: Date | null
  /** Kosmetik yang sedang dipakai. Ikut di potret sesi karena profil menggambarnya di setiap
   * pembukaan halaman, dan permintaan terpisah untuk dua kolom teks tidak pernah sepadan. */
  equippedFrame: string | null
  equippedTitle: string | null
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
    gaspol_until: Date | null
    equipped_frame: string | null
    equipped_title: string | null
    channel_bonus_claimed_at: Date | null
    channel_member: boolean | null
    channel_checked_at: Date | null
  }>(
    `update sessions s set last_seen_at=now() from users u where s.token_hash=$1 and s.user_id=u.id and s.revoked_at is null and s.expires_at>now() returning u.id,u.public_id,u.telegram_id,u.first_name,u.username,u.photo_url,u.balance_credits,u.referral_code,u.banned_at,u.is_admin,u.premium_until,u.gaspol_until,u.equipped_frame,u.equipped_title,u.channel_bonus_claimed_at,u.channel_member,u.channel_checked_at`,
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
        gaspolUntil: row.gaspol_until,
        equippedFrame: row.equipped_frame,
        equippedTitle: row.equipped_title,
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

/** Plafon untuk permukaan BACA panel admin. Halamannya React Server Component, jadi
 * `router.refresh()` memukul endpoint RSC — bukan `/api/admin/*` — dan plafon yang terpasang di
 * route API tidak pernah berlaku untuknya. Sementara kueri di baliknya adalah yang terberat di
 * aplikasi: agregat tanpa batas waktu atas seluruh tabel, dijalankan berkali-kali per menit
 * selama satu tab ditinggal terbuka. Satu ember per admin, bukan per permukaan: yang dijaga
 * adalah beban database, dan beban itu dijumlahkan lintas tab. Angkanya jauh di atas pemakaian
 * manusia — ia hanya menghentikan tab yang lepas kendali. Jalur TULIS tetap `requireAdmin()`
 * biasa; plafonnya sudah ada di route API-nya masing-masing. */
const ADMIN_READ_LIMIT = 900
const ADMIN_READ_WINDOW_SECONDS = 3_600

export async function requireAdminRead() {
  const admin = await requireAdmin()
  await enforceRateLimit(`admin-read:${admin.id}`, ADMIN_READ_LIMIT, ADMIN_READ_WINDOW_SECONDS)
  return admin
}

export async function destroySession() {
  const jar = await cookies()
  const token = await readSessionToken()
  if (token) {
    await query('update sessions set revoked_at=now() where token_hash=$1', [hashToken(token)])
  }
  // Cookie berpartisi hanya terhapus jika atribut kuncinya diulang.
  jar.delete({ name: COOKIE_NAME, path: '/', secure: true, sameSite: 'none', partitioned: true })
}
