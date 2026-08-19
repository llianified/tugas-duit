import { env } from '@/server/env'
import { escapeTelegramHtml, sendTelegramMessage } from '@/server/telegram'

export const runtime = 'nodejs'

const miniAppUrl = () => `https://t.me/${env.botUsername}/app`

function startMessage(firstName: string | null) {
  const sapaan = firstName ? `Hai ${escapeTelegramHtml(firstName)}! 👋` : 'Hai! 👋'
  return [
    `<b>${sapaan}</b>`,
    '',
    'Selamat datang di <b>Tugas Duit</b> — tempat rebahan yang tetap bisa cuan.',
    'Cara mainnya simpel banget: pecahin captcha, kumpulin credit, tukar jadi Rupiah. Nggak ada modal, nggak ada drama.',
    '',
    '⚡ Energi ngisi sendiri, jadi bisa main tiap hari',
    '🔥 Makin rajin, streak-nya makin gede',
    '👋 Ajak teman, kalian dapet bonus dua-duanya',
    '💸 Cair ke e-wallet atau bank',
    '',
    'Tap tombol di bawah, langsung gas 👇',
  ].join('\n')
}

export async function POST(request: Request) {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== env.webhookSecret) {
    return new Response(null, { status: 401 })
  }

  const update = (await request.json().catch(() => null)) as {
    message?: { chat?: { id: number }; text?: string; from?: { first_name?: string } }
  } | null
  const chatId = update?.message?.chat?.id

  if (chatId && update?.message?.text?.startsWith('/start')) {
    await sendTelegramMessage(String(chatId), startMessage(update.message.from?.first_name ?? null), {
      replyMarkup: {
        inline_keyboard: [[{ text: '🎮 Buka Tugas Duit', url: miniAppUrl() }]],
      },
    }).catch((error) => console.warn('[telegram] pesan gagal', error))
  }

  return Response.json({ ok: true })
}
