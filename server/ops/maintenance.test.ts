import { beforeAll, describe, expect, it, vi } from 'vitest'
import { maintenanceCronSchedule } from '../../tests/maintenance-workflow'
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
      challengePayloads: expect.any(Number),
      rateLimits: expect.any(Number),
      sessions: expect.any(Number),
      initData: expect.any(Number),
      fraudSignals: expect.any(Number),
      botNotifications: expect.any(Number),
      inactivePremiumWithdrawals: expect.any(Number),
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

describe('MAINT-4 — isi soal selesai dilepas, soal aktif tidak', () => {
  /** `payload` soal yang sudah ditutup adalah pos terbesar di database, dan baris induknya
   * sendiri tidak bisa dihapus karena `task_completions` menahannya dengan `ON DELETE
   * RESTRICT`. Dua test di bawah menjaga kedua sisi yang membuat pelepasannya aman: yang
   * ditutup kehilangan isinya, dan yang masih berjalan mempertahankannya — sebab kalau sisi
   * kedua ikut terbawa, soal yang sedang dikerjakan pemain berubah jadi soal tanpa
   * pertanyaan. */
  const seedChallenge = async (submitted: boolean) => {
    const { query } = await import('../platform/db')
    const { generateReferralCode } = await import('../economy/referral')
    const user = await query<{ id: string }>(
      `insert into users(telegram_id,first_name,referral_code)
       values($1,'Uji payload',$2) returning id`,
      [800_100_000_000_000 + Math.floor(Math.random() * 1_000_000_000), generateReferralCode()],
    )
    const rows = await query<{ id: string }>(
      `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,submitted_at)
       values($1,'text','Easy','{"pertanyaan":"2+2"}','\\x00',1,now(),${submitted ? 'now()' : 'null'})
       returning id`,
      [user[0].id],
    )
    return rows[0].id
  }

  const payloadOf = async (id: string) => {
    const { query } = await import('../platform/db')
    const rows = await query<{ payload: Record<string, unknown> }>(
      'select payload from challenges where id=$1',
      [id],
    )
    return rows[0].payload
  }

  it('mengosongkan payload soal yang sudah disubmit', async () => {
    const { runMaintenance } = await import('./maintenance')
    const id = await seedChallenge(true)

    await runMaintenance()

    expect(await payloadOf(id)).toEqual({})
  }, 60_000)

  it('mempertahankan payload soal yang belum disubmit', async () => {
    const { runMaintenance } = await import('./maintenance')
    const id = await seedChallenge(false)

    await runMaintenance()

    expect(await payloadOf(id)).toEqual({ pertanyaan: '2+2' })
  }, 60_000)
})

describe('MAINT-2 — jadwal cron jatuh di dalam jam kirim WIB', () => {
  /** Sekali jalan per hari di jam yang salah membuat notifikasi diam total tanpa error. */
  it('memicu pemeliharaan pada jam yang masih mengirim pesan', async () => {
    const schedule = await maintenanceCronSchedule()
    const [, jamUtc] = schedule.trim().split(/\s+/)
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
