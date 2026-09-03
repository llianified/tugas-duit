import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  sendTelegramMessage: vi.fn(),
}))

vi.mock('@/server/platform/db', () => ({ query: mocks.query }))
const envMock = vi.hoisted(() => ({ webhookSecretOrNull: 'secret-uji' as string | null }))
vi.mock('@/server/platform/env', () => ({ env: envMock }))
vi.mock('@/server/integrations/telegram', () => ({
  escapeTelegramHtml: (value: string) => value,
  openAppMarkup: vi.fn(() => ({ inline_keyboard: [] })),
  sendTelegramMessage: mocks.sendTelegramMessage,
}))

import { POST } from './route'

const request = (body: unknown, secret = 'secret-uji') =>
  new Request('https://app.example/api/telegram/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify(body),
  })

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('menolak request tanpa secret Telegram yang tepat', async () => {
    const response = await POST(request({ message: { text: '/start' } }, 'salah'))

    expect(response.status).toBe(401)
    expect(mocks.query).not.toHaveBeenCalled()
  })

  /** `env.webhookSecret` MELEMPAR saat env-nya kosong, dan lemparnya terjadi sebelum `try` di route ini — jadi env yang belum diset dulu menjadi 500, status yang justru membuat Telegram mengulang kirim tanpa henti. Tanpa secret, jawabannya harus 401: menolak semua orang, bukan membuka diri. Bentuk yang sama dengan `CRON_SECRET` di `app/api/cron/maintenance`. */
  it('menolak, bukan melempar, saat TELEGRAM_WEBHOOK_SECRET belum diset', async () => {
    envMock.webhookSecretOrNull = null
    try {
      const response = await POST(request({ message: { chat: { id: 42 }, text: '/start' } }))

      expect(response.status).toBe(401)
      expect(mocks.query).not.toHaveBeenCalled()
      expect(mocks.sendTelegramMessage).not.toHaveBeenCalled()
    } finally {
      envMock.webhookSecretOrNull = 'secret-uji'
    }
  })

  it('menolak secret yang panjangnya berbeda tanpa melempar', async () => {
    const response = await POST(request({ message: { text: '/start' } }, 'x'))

    expect(response.status).toBe(401)
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('mengakui payload non-command tanpa menyentuh database', async () => {
    const response = await POST(request({ message: { chat: { id: 42 }, text: 'halo' } }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('memproses ulang /stop secara idempoten dengan assignment, bukan toggle', async () => {
    mocks.query.mockResolvedValue([{ id: '1' }])
    const command = { message: { chat: { id: 42 }, text: '/stop' } }

    await POST(request(command))
    await POST(request(command))

    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('set notifications_muted_at=$2'),
      ['42', expect.any(Date)],
    )
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('set notifications_muted_at=$2'),
      ['42', expect.any(Date)],
    )
  })
})
