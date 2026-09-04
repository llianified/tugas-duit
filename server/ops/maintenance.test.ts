import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ENGAGEMENT_HOURS } from '../messaging/engagement'
import { matchesSecret } from '../platform/secret'

vi.mock('../integrations/telegram.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../integrations/telegram')>()),
  sendTelegramMessage: vi.fn(async () => {}),
  openAppMarkup: () => ({}),
}))

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

describe('MAINT-1 — seluruh pernyataan pemeliharaan jalan di database', () => {
  /** Tugas pemeliharaan menyentuh tujuh tabel, dan sebelum ini tidak ada satu pun test yang menjalankannya — sementara cron-nya sendiri belum pernah sekali pun selesai di produksi, jadi tidak ada bukti dari sana juga. `rate_limits` dan `used_init_data` berkunci gabungan tanpa kolom `id`, jenis perbedaan yang hanya ketahuan saat SQL-nya benar-benar dieksekusi. */
  it('menyelesaikan satu putaran penuh tanpa error SQL', async () => {
    const { runMaintenance } = await import('./maintenance')
    const summary = await runMaintenance()

    expect(summary).toMatchObject({
      challenges: expect.any(Number),
      rateLimits: expect.any(Number),
      sessions: expect.any(Number),
      initData: expect.any(Number),
      fraudSignals: expect.any(Number),
      botNotifications: expect.any(Number),
      balanceDrift: expect.any(Number),
    })
  /** Tenggat panjang karena ini menjalankan SATU putaran pemeliharaan penuh atas database uji yang tidak pernah dikosongkan antar-run: tujuh tabel disapu, dan biayanya naik seiring baris yang ditinggalkan run-run sebelumnya. Tenggat bawaan 5 detik membuat test ini lulus di mesin bersih lalu gagal beberapa run kemudian tanpa ada kode yang berubah — kegagalan yang tidak menunjukkan apa pun selain umur direktori datanya. */
  }, 60_000)

  it('benar-benar menghapus baris yang sudah lewat masa simpannya', async () => {
    const { execute, query } = await import('../platform/db')
    const { runMaintenance } = await import('./maintenance')

    const bucket = `pemeliharaan-${Date.now().toString(36)}`
    await execute(
      `insert into rate_limits(bucket,window_start,count) values($1, now() - interval '3 hours', 1)`,
      [bucket],
    )

    await runMaintenance()

    const sisa = await query('select 1 from rate_limits where bucket=$1', [bucket])
    expect(sisa).toEqual([])
  })

  it('membiarkan baris yang masih di dalam masa simpannya', async () => {
    const { execute, query } = await import('../platform/db')
    const { runMaintenance } = await import('./maintenance')

    const bucket = `pemeliharaan-baru-${Date.now().toString(36)}`
    await execute(
      'insert into rate_limits(bucket,window_start,count) values($1, now(), 1)',
      [bucket],
    )

    await runMaintenance()

    const sisa = await query('select 1 from rate_limits where bucket=$1', [bucket])
    expect(sisa).toHaveLength(1)
  })
})

describe('MAINT-2 — jadwal cron jatuh di dalam jam kirim WIB', () => {
  /** `runEngagementNotifications` diam total di luar 08:00–20:00 WIB. Di Railway hal ini tidak pernah jadi soal karena cron-nya tiap jam, jadi selalu ada jalan yang jatuh di dalam jendela. Vercel plan Hobby membatasi cron ke sekali sehari, dan sekali sehari di jam yang salah berarti pesan bot tidak pernah terkirim — tanpa error, tanpa jejak. */
  it('memicu pemeliharaan pada jam yang masih mengirim pesan', async () => {
    const raw = await readFile(path.join(process.cwd(), 'vercel.json'), 'utf8')
    const crons = (JSON.parse(raw) as { crons: { path: string; schedule: string }[] }).crons
    const maintenance = crons.find((cron) => cron.path === '/api/cron/maintenance')
    expect(maintenance).toBeDefined()

    const [, jamUtc] = maintenance!.schedule.trim().split(/\s+/)
    expect(jamUtc).toMatch(/^\d+$/)

    const jamWib = (Number(jamUtc) + 7) % 24
    expect(jamWib).toBeGreaterThanOrEqual(ENGAGEMENT_HOURS.first)
    expect(jamWib).toBeLessThanOrEqual(ENGAGEMENT_HOURS.last)
  })

  it('memilih jam yang juga menangkap pengingat streak', () => {
    expect(ENGAGEMENT_HOURS.streakReminder).toContain(19)
  })
})

describe('MAINT-3 — gerbang rahasia cron', () => {
  it('menolak rahasia yang salah', () => {
    expect(matchesSecret('salah', 'benar')).toBe(false)
  })

  it('menerima yang sama persis', () => {
    expect(matchesSecret('rahasia-sama', 'rahasia-sama')).toBe(true)
  })

  /** `timingSafeEqual` melempar kalau dua buffer-nya beda panjang. Karena itu keduanya di-hash dulu; tanpa itu, rahasia sepanjang berapa pun dari penyerang membuat route cron 500, bukan 401 — dan panjang yang benar jadi bisa ditebak dari bedanya respons. */
  it('tidak melempar untuk panjang yang berbeda jauh', () => {
    expect(matchesSecret('a', 'rahasia-yang-jauh-lebih-panjang')).toBe(false)
    expect(matchesSecret('rahasia-yang-jauh-lebih-panjang', 'a')).toBe(false)
  })
})
