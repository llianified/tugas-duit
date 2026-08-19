import { env } from '@/server/env'
import { sendTelegramMessage } from '@/server/telegram'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== env.webhookSecret) {
    return new Response(null, { status: 401 })
  }

  const update = (await request.json().catch(() => null)) as {
    message?: { chat?: { id: number }; text?: string }
  } | null
  const chatId = update?.message?.chat?.id

  if (chatId && update?.message?.text?.startsWith('/start')) {
    await sendTelegramMessage(
      String(chatId),
      `Selamat datang di Tugas Duit. Buka Mini App: https://t.me/${env.botUsername}/app`,
    ).catch((error) => console.warn('[telegram] pesan gagal', error))
  }

  return Response.json({ ok: true })
}
