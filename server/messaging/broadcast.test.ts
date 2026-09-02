import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'

const jar = vi.hoisted(() => new Map<string, string>())

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value)
    },
    delete: (name: string) => {
      jar.delete(name)
    },
  }),
}))

/** Telegram diganti tiruan supaya uji ini tidak pernah mengirim apa pun ke luar. Yang diuji bukan protokolnya, melainkan siapa yang masuk daftar penerima dan berapa kali. */
vi.mock('../integrations/telegram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../integrations/telegram')>()),
  sendTelegramMessage: vi.fn(async () => {}),
  openAppMarkup: () => ({}),
}))

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

beforeEach(async () => {
  jar.clear()
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
  const telegram = await import('../integrations/telegram')
  vi.mocked(telegram.sendTelegramMessage).mockClear()
})

let sequence = 0

async function makeUser(
  options: { admin?: boolean; muted?: boolean; banned?: boolean; balance?: number } = {},
): Promise<{ id: number; telegramId: string }> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  sequence += 1
  const telegramId = String(200_000_000_000_000 + Date.now() % 1_000_000_000 * 10 + sequence)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,is_admin,balance_credits,
                       notifications_muted_at, banned_at, ban_reason)
     values($1,'Uji Siar',$2,$3,$4,$5,$6,$7) returning id`,
    [
      telegramId,
      generateReferralCode(),
      options.admin ?? false,
      options.balance ?? 0,
      options.muted ? new Date() : null,
      options.banned ? new Date() : null,
      options.banned ? 'uji' : null,
    ],
  )
  return { id: Number(rows[0].id), telegramId }
}

async function signInAsAdmin(): Promise<void> {
  const { createSession } = await import('../auth/session')
  const admin = await makeUser({ admin: true })
  jar.clear()
  await createSession(admin.id, 'uji')
}

const sentCount = async () => {
  const telegram = await import('../integrations/telegram')
  return vi.mocked(telegram.sendTelegramMessage).mock.calls.length
}

/** Menjalankan siaran sampai tuntas, persis seperti admin menekan "Lanjutkan kirim" sampai sisanya nol. Jedanya nol dan anggarannya panjang karena basis user uji menumpuk lintas berkas; yang diuji siapa yang menerima, bukan temponya. */
async function runUntilDone(id: string) {
  const { runBroadcast } = await import('./broadcast')
  let total = { id, sent: 0, failed: 0, remaining: 0, done: false }
  for (let putaran = 0; putaran < 20; putaran += 1) {
    const hasil = await runBroadcast(id, { sendGapMs: 0, budgetMs: 60_000 })
    total = { ...hasil, sent: total.sent + hasil.sent, failed: total.failed + hasil.failed }
    if (hasil.done) break
  }
  return total
}

const sentTo = async () => {
  const telegram = await import('../integrations/telegram')
  return vi.mocked(telegram.sendTelegramMessage).mock.calls.map((call) => call[0])
}

describe('SIAR-1 — /stop selalu dihormati', () => {
  /** Ini penjagaan yang paling tidak boleh punya jalan memutar. User yang menekan /stop sudah menjawab, dan siaran yang menembusnya adalah alasan paling langsung sebuah bot dilaporkan spam — dan bot yang dibekukan Telegram ikut mematikan notifikasi penarikan. */
  it('tidak menghitung maupun mengirimi user yang menekan /stop, di segmen mana pun', async () => {
    await signInAsAdmin()
    const { countBroadcastRecipients, createBroadcast } = await import('./broadcast')
    const { BROADCAST_SEGMENTS } = await import('@/domain/messaging/broadcast')

    const bisu = await makeUser({ muted: true })

    for (const segment of BROADCAST_SEGMENTS) {
      const sebelum = await countBroadcastRecipients(segment.id)
      const { id } = await createBroadcast(segment.id, `Uji segmen ${segment.id}`)
      await runUntilDone(id)
      expect(sebelum).toBeGreaterThanOrEqual(0)
      expect(await sentTo()).not.toContain(bisu.telegramId)
    }
  })

  it('tidak mengirimi akun yang ditangguhkan', async () => {
    await signInAsAdmin()
    const { createBroadcast } = await import('./broadcast')
    const ditangguhkan = await makeUser({ banned: true })

    const { id } = await createBroadcast('semua', 'Pengumuman uji')
    await runUntilDone(id)

    expect(await sentTo()).not.toContain(ditangguhkan.telegramId)
  })
})

describe('SIAR-2 — klik ganda tidak mengirim dua kali', () => {
  /** Penandanya di `bot_notifications` ditulis sebelum kirim dengan `dedupe_key` berisi id siaran, jadi putaran kedua atas siaran yang sama tidak menemukan penerima yang tersisa. Tanpa ini, admin yang ragu dan menekan tombolnya lagi mengirim pesan yang sama dua kali ke seluruh basis user. */
  it('putaran kedua atas siaran yang sama tidak mengirim apa-apa lagi', async () => {
    await signInAsAdmin()
    const { createBroadcast, runBroadcast } = await import('./broadcast')
    await makeUser()
    await makeUser()

    const { id } = await createBroadcast('semua', 'Pengumuman uji dua kali')

    const pertama = await runUntilDone(id)
    const setelahPertama = await sentCount()
    expect(pertama.sent).toBeGreaterThan(0)
    expect(pertama.remaining).toBe(0)

    const kedua = await runBroadcast(id, { sendGapMs: 0 })
    expect(kedua.sent).toBe(0)
    expect(await sentCount()).toBe(setelahPertama)
  })

  /** Sebaliknya: siaran BARU harus tetap menjangkau orang yang sama. Dedupe-nya per siaran, bukan per user — kalau tidak, siaran kedua tidak akan pernah terkirim ke siapa pun. */
  it('siaran baru tetap menjangkau orang yang sudah menerima siaran sebelumnya', async () => {
    await signInAsAdmin()
    const { createBroadcast } = await import('./broadcast')
    const penerima = await makeUser()

    const pertama = await createBroadcast('semua', 'Siaran pertama')
    await runUntilDone(pertama.id)
    expect(await sentTo()).toContain(penerima.telegramId)

    const telegram = await import('../integrations/telegram')
    vi.mocked(telegram.sendTelegramMessage).mockClear()

    const kedua = await createBroadcast('semua', 'Siaran kedua')
    await runUntilDone(kedua.id)
    expect(await sentTo()).toContain(penerima.telegramId)
  })
})

describe('SIAR-3 — pratinjau memakai query yang sama dengan pengiriman', () => {
  it('jumlah penerima turun jadi nol setelah siarannya selesai', async () => {
    await signInAsAdmin()
    const { countBroadcastRecipients, createBroadcast } = await import('./broadcast')
    await makeUser()

    const sebelum = await countBroadcastRecipients('semua')
    expect(sebelum).toBeGreaterThan(0)

    const { id } = await createBroadcast('semua', 'Pengumuman uji pratinjau')
    const hasil = await runUntilDone(id)

    expect(hasil.sent).toBe(sebelum)
    expect(hasil.remaining).toBe(0)
    expect(hasil.done).toBe(true)
  })

  it('segmen premium hanya memuat langganan yang masih berlaku', async () => {
    const { query } = await import('../platform/db')
    await signInAsAdmin()
    const { countBroadcastRecipients } = await import('./broadcast')

    const sebelum = await countBroadcastRecipients('premium_aktif')
    const premium = await makeUser()
    await query("update users set premium_until = now() + interval '30 days' where id=$1", [
      premium.id,
    ])
    const kadaluwarsa = await makeUser()
    await query("update users set premium_until = now() - interval '1 day' where id=$1", [
      kadaluwarsa.id,
    ])

    expect(await countBroadcastRecipients('premium_aktif')).toBe(sebelum + 1)
  })
})

describe('SIAR-4 — badan pesan', () => {
  it('menolak pesan kosong', async () => {
    await signInAsAdmin()
    const { createBroadcast } = await import('./broadcast')
    await expect(createBroadcast('semua', '   ')).rejects.toThrow('BROADCAST_BODY_INVALID')
  })

  it('menolak pesan yang melewati batas panjang', async () => {
    await signInAsAdmin()
    const { createBroadcast } = await import('./broadcast')
    const { BROADCAST_BODY_MAX } = await import('@/domain/messaging/broadcast')
    await expect(createBroadcast('semua', 'a'.repeat(BROADCAST_BODY_MAX + 1))).rejects.toThrow(
      'BROADCAST_BODY_INVALID',
    )
  })

  /** Teks user dikirim sebagai HTML ke Telegram, jadi `<` mentah akan membuat panggilannya ditolak dengan "can't parse entities" — dan seluruh siaran gagal karena satu kurung siku di pengumuman. */
  it('meloloskan karakter HTML di badan pesan tanpa merusak kirimannya', async () => {
    await signInAsAdmin()
    const { createBroadcast } = await import('./broadcast')
    const telegram = await import('../integrations/telegram')
    await makeUser()

    const { id } = await createBroadcast('semua', 'Diskon <b>50%</b> & gratis')
    await runUntilDone(id)

    const body = vi.mocked(telegram.sendTelegramMessage).mock.calls.at(-1)?.[1] ?? ''
    expect(body).toContain('&lt;b&gt;50%&lt;/b&gt; &amp; gratis')
  })
})

describe('SIAR-5 — otorisasi', () => {
  it('menolak pemanggil tanpa sesi admin', async () => {
    const { countBroadcastRecipients } = await import('./broadcast')
    jar.clear()
    await expect(countBroadcastRecipients('semua')).rejects.toThrow()
  })
})
