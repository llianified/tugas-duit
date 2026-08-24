import { query } from '@/server/db'
import { env } from '@/server/env'
import { escapeTelegramHtml, openAppMarkup, sendTelegramMessage } from '@/server/telegram'

export const runtime = 'nodejs'

function startMessage(firstName: string | null) {
  const sapaan = firstName ? `Hai ${escapeTelegramHtml(firstName)}! 👋` : 'Hai! 👋'
  return [
    `<b>${sapaan}</b>`,
    '',
    'Selamat datang di <b>Tugas Duit</b> — tempat rebahan yang tetap bisa cuan.',
    'Cara mainnya simpel banget: pecahin captcha, kumpulin credit, tukar jadi Rupiah. Nggak ada modal, nggak ada drama.',
    '',
    '⚡ Energi ngisi sendiri, jadi bisa main tiap hari',
    '💰 Stok reward juga ngisi sendiri, tinggal dihabisin',
    '🔥 Makin rajin, streak-nya makin gede',
    '👋 Ajak teman, kalian dapet bonus dua-duanya',
    '💸 Cair ke e-wallet atau bank',
    '',
    'Tap tombol di bawah, langsung gas 👇',
  ].join('\n')
}

const HELP_MESSAGE = [
  '<b>Cara mainnya 🎮</b>',
  '',
  '1. Buka app-nya, ambil captcha, jawab yang bener.',
  '2. Makin cepat jawabnya, makin gede bintangnya, makin gede credit-nya.',
  '3. Tiap task motong 1 energi. Energi ngisi sendiri, nggak perlu ditungguin.',
  '4. Bayaran task diambil dari stok reward kamu. Stoknya juga ngisi sendiri, dan makin gede kalau rank sama streak kamu naik.',
  '5. Saldo udah cukup? Tarik ke e-wallet atau bank.',
  '',
  '<b>Perintah</b>',
  '/start — buka app',
  '/stop — setop pesan ajakan dari bot',
  '/help — pesan ini',
  '',
  'Kabar soal penarikan tetap dikirim walau kamu /stop — itu kabar duit kamu, bukan promosi.',
].join('\n')

const STOP_MESSAGE = [
  '<b>Oke, pesan ajakannya kami setop 🔕</b>',
  '',
  'Nggak ada lagi pesan soal energi penuh, streak, atau ajakan balik main.',
  'Kabar penarikan tetap jalan ya — itu soal duit kamu.',
  '',
  'Kalau nanti berubah pikiran, kirim /start lagi.',
].join('\n')

const RESUMED_LINE = 'Pesan ajakan dari bot kami nyalain lagi 🔔'

async function setMuted(telegramId: string, muted: boolean): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'update users set notifications_muted_at=$2 where telegram_id=$1 returning id',
    [telegramId, muted ? new Date() : null],
  )
  return rows.length > 0
}

async function wasMuted(telegramId: string): Promise<boolean> {
  const rows = await query<{ notifications_muted_at: Date | null }>(
    'select notifications_muted_at from users where telegram_id=$1',
    [telegramId],
  )
  return Boolean(rows[0]?.notifications_muted_at)
}

export async function POST(request: Request) {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== env.webhookSecret) {
    return new Response(null, { status: 401 })
  }

  const update = (await request.json().catch(() => null)) as {
    message?: { chat?: { id: number }; text?: string; from?: { first_name?: string } }
  } | null
  const chatId = update?.message?.chat?.id
  const text = update?.message?.text ?? ''
  if (!chatId || !text.startsWith('/')) return Response.json({ ok: true })

  const command = text.split(/[\s@]/)[0]
  const telegramId = String(chatId)

  try {
    if (command === '/stop') {
      const known = await setMuted(telegramId, true)
      await sendTelegramMessage(
        telegramId,
        known ? STOP_MESSAGE : 'Kamu belum pernah buka app-nya, jadi belum ada pesan yang perlu disetop.',
      )
      return Response.json({ ok: true })
    }

    if (command === '/help') {
      await sendTelegramMessage(telegramId, HELP_MESSAGE, openAppMarkup('🎮 Buka Tugas Duit'))
      return Response.json({ ok: true })
    }

    if (command === '/start') {
      const resumed = await wasMuted(telegramId)
      if (resumed) await setMuted(telegramId, false)
      const body = startMessage(update?.message?.from?.first_name ?? null)
      await sendTelegramMessage(
        telegramId,
        resumed ? `${body}\n\n${RESUMED_LINE}` : body,
        openAppMarkup('🎮 Buka Tugas Duit'),
      )
    }
  } catch (error) {
    console.warn('[telegram] pesan gagal', error)
  }

  return Response.json({ ok: true })
}
