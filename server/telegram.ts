import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { query } from './db.ts'
import { env } from './env.ts'

const MAX_AUTH_AGE_SECONDS = 900
interface TelegramUser { id: number; first_name: string; username?: string; photo_url?: string }
type VerifyResult = { ok: true; user: TelegramUser; startParam: string | null; hash: string; authDate: number } | { ok: false; reason: 'malformed' | 'bad_hash' | 'expired' | 'no_user' }

export function verifyInitData(initData: string): VerifyResult {
  if (!initData) return { ok: false, reason: 'malformed' }
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { ok: false, reason: 'malformed' }
  const data = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(env.botToken).digest()
  const expected = createHmac('sha256', secret).update(data).digest()
  const received = Buffer.from(hash, 'hex')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return { ok: false, reason: 'bad_hash' }
  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate)) return { ok: false, reason: 'malformed' }
  const age = Math.floor(Date.now() / 1000) - authDate
  if (age > MAX_AUTH_AGE_SECONDS || age < -60) return { ok: false, reason: 'expired' }
  const raw = params.get('user')
  if (!raw) return { ok: false, reason: 'no_user' }
  try {
    const user = JSON.parse(raw) as TelegramUser
    return typeof user.id === 'number' ? { ok: true, user, startParam: params.get('start_param'), hash, authDate } : { ok: false, reason: 'no_user' }
  } catch { return { ok: false, reason: 'malformed' } }
}

export async function claimInitData(hash: string, authDate: number): Promise<boolean> {
  const rows = await query<{ hash: Buffer }>(
    `insert into used_init_data(hash, expires_at) values($1, to_timestamp($2))
     on conflict(hash) do nothing
     returning hash`,
    [createHash('sha256').update(hash).digest(), authDate + MAX_AUTH_AGE_SECONDS],
  )
  return rows.length > 0
}

const JOINED_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted'])

/**
 * `null` berarti **tidak bisa dipastikan** — bot belum jadi admin channel, token salah,
 * atau Telegram sedang tidak menjawab. Dibedakan dari `false` supaya pemanggilnya tidak
 * pernah menerjemahkan kegagalan pemeriksaan menjadi "user tidak join", dan sebaliknya
 * tidak pernah memberi bonus atas dasar tebakan.
 */
export async function readChannelMembership(telegramId: string): Promise<boolean | null> {
  const url = new URL(`https://api.telegram.org/bot${env.botToken}/getChatMember`)
  url.searchParams.set('chat_id', env.telegramChannelId)
  url.searchParams.set('user_id', telegramId)

  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  } catch {
    return null
  }

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean
    result?: { status?: string }
  } | null
  if (!body?.ok || typeof body.result?.status !== 'string') return null
  return JOINED_STATUSES.has(body.result.status)
}

export const escapeTelegramHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type InlineButton = { text: string; url: string } | { text: string; web_app: { url: string } }
export interface SendMessageOptions { replyMarkup?: { inline_keyboard: InlineButton[][] } }

export async function sendTelegramMessage(chatId: string, text: string, options: SendMessageOptions = {}) {
  const response = await fetch(`https://api.telegram.org/bot${env.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    }),
  })
  if (!response.ok) throw new Error(`Telegram API ${response.status}`)
}

export function openAppMarkup(label: string): SendMessageOptions {
  const bot = env.botUsernameOrNull
  if (!bot) return {}
  return { replyMarkup: { inline_keyboard: [[{ text: label, url: `https://t.me/${bot}/app` }]] } }
}
