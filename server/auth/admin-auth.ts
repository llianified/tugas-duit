import { query } from '../platform/db'
import { env } from '../platform/env'
import { matchesSecret } from '../platform/secret'
import { createSession } from './session'

const MIN_PASSWORD_LENGTH = 24

export type AdminLoginFailure =
  | 'NOT_CONFIGURED'
  | 'INVALID_PASSWORD'
  | 'UNKNOWN_ADMIN'
  | 'BANNED'

type AdminLoginResult = { ok: true } | { ok: false; reason: AdminLoginFailure }

export async function loginAdminWithPassword(
  password: string,
  userAgent: string | null,
): Promise<AdminLoginResult> {
  const expected = env.adminPasswordOrNull
  const telegramId = env.adminTelegramIdOrNull

  if (!expected || !telegramId || expected.length < MIN_PASSWORD_LENGTH) {
    console.warn(
      '[admin-auth] Login sandi tidak aktif: setel ADMIN_PASSWORD (minimum %d karakter) dan ADMIN_TELEGRAM_ID.',
      MIN_PASSWORD_LENGTH,
    )
    return { ok: false, reason: 'NOT_CONFIGURED' }
  }
  if (!/^\d+$/.test(telegramId)) {
    console.warn('[admin-auth] ADMIN_TELEGRAM_ID bukan angka; nilainya diabaikan.')
    return { ok: false, reason: 'NOT_CONFIGURED' }
  }

  if (!matchesSecret(password, expected)) return { ok: false, reason: 'INVALID_PASSWORD' }

  const rows = await query<{ id: string; banned_at: Date | null; is_admin: boolean }>(
    'select id, banned_at, is_admin from users where telegram_id=$1',
    [telegramId],
  )
  const owner = rows[0]
  if (!owner) return { ok: false, reason: 'UNKNOWN_ADMIN' }
  if (owner.banned_at) return { ok: false, reason: 'BANNED' }

  await createSession(Number(owner.id), userAgent)
  return { ok: true }
}
