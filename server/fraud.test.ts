import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { SWEEP_THRESHOLDS } from './fraud'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

let suffix = 0
const nextTelegramId = () => 700_000_000_000_000 + Date.now() % 1_000_000_000 + (suffix += 1)

async function makeUser(options: { referredBy?: number; banned?: boolean } = {}): Promise<number> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,referred_by,banned_at)
     values($1,'Uji Fraud',$2,$3,$4) returning id`,
    [
      nextTelegramId(),
      generateReferralCode(),
      options.referredBy ?? null,
      options.banned ? new Date() : null,
    ],
  )
  return Number(rows[0].id)
}

/**
 * Membuat sejumlah downline pada rentang waktu yang ditentukan, relatif terhadap sekarang.
 * `spanSeconds` yang kecil membuat mereka rapat (burst), yang besar membuatnya menyebar.
 */
async function makeDownlines(
  uplineId: number,
  count: number,
  minutesAgo: number,
  spanSeconds: number,
): Promise<void> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const codes = Array.from({ length: count }, () => generateReferralCode())
  const ids = Array.from({ length: count }, () => nextTelegramId())
  await query(
    `insert into users(telegram_id,first_name,referral_code,referred_by,created_at)
     select t.id, 'Downline Uji', t.code, $1,
            now() - ($2::int * interval '1 minute') + (t.rn * ($3::numeric / $4) * interval '1 second')
       from unnest($5::bigint[], $6::text[]) with ordinality as t(id, code, rn)`,
    [uplineId, minutesAgo, spanSeconds, count, ids, codes],
  )
}

/**
 * Membuat `count` challenge terpecahkan beserta task_completions-nya. `wrong` menentukan
 * berapa di antaranya pernah dijawab salah, `spreadMs` selisih dua nilai `elapsed_ms` yang
 * dipakai bergantian — simpangan bakunya kira-kira setengah dari selisih itu.
 */
async function makeSolvedTasks(
  userId: number,
  count: number,
  options: { wrong?: number; baseMs?: number; spreadMs?: number } = {},
): Promise<void> {
  const { query } = await import('./db')
  await query(
    `with baru as (
       insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,
                              expires_at,submitted_at,solved,attempts)
       select $1,'text','Easy','{}','\\x00',9,now(),now(),true,
              case when g <= $3 then 1 else 0 end
         from generate_series(1,$2) g
       returning id
     ), bernomor as (
       select id, (row_number() over ())::int rn from baru
     )
     insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward)
     select $1, id, 'text', 'Easy', $4 + (rn % 2) * $5, 3, 1 from bernomor`,
    [userId, count, options.wrong ?? 0, options.baseMs ?? 3_000, options.spreadMs ?? 0],
  )
}

async function sweep(): Promise<void> {
  const { transaction } = await import('./db')
  const { sweepFraudSignals } = await import('./fraud')
  await transaction((tx) => sweepFraudSignals(tx))
}

async function signalsFor(userId: number, signal: string): Promise<number> {
  const { query } = await import('./db')
  const rows = await query<{ jumlah: number }>(
    'select count(*)::int jumlah from fraud_signals where user_id=$1 and signal=$2',
    [userId, signal],
  )
  return Number(rows[0].jumlah)
}

describe('FRAUD-1 — referral_burst melihat seluruh rentang sapuan, bukan hanya menit terakhir', () => {
  it('menangkap burst yang terjadi jauh sebelum sapuan berjalan', async () => {
    const upline = await makeUser()
    await makeDownlines(upline, SWEEP_THRESHOLDS.referralBurstThreshold, 45, 180)

    await sweep()

    expect(await signalsFor(upline, 'referral_burst')).toBe(1)
  })

  it('tidak menandai pendaftaran yang menyebar sepanjang rentang', async () => {
    const upline = await makeUser()
    const spanSeconds = SWEEP_THRESHOLDS.referralBurstWindowMinutes * 60 * 20
    await makeDownlines(upline, SWEEP_THRESHOLDS.referralBurstThreshold, 170, spanSeconds)

    await sweep()

    expect(await signalsFor(upline, 'referral_burst')).toBe(0)
  })

  it('tidak menandai jumlah di bawah ambang walau rapat', async () => {
    const upline = await makeUser()
    await makeDownlines(upline, SWEEP_THRESHOLDS.referralBurstThreshold - 1, 30, 60)

    await sweep()

    expect(await signalsFor(upline, 'referral_burst')).toBe(0)
  })

  it('melewati upline yang sudah dibanned', async () => {
    const upline = await makeUser({ banned: true })
    await makeDownlines(upline, SWEEP_THRESHOLDS.referralBurstThreshold, 45, 180)

    await sweep()

    expect(await signalsFor(upline, 'referral_burst')).toBe(0)
  })

  it('tidak menulis sinyal kedua di hari yang sama', async () => {
    const upline = await makeUser()
    await makeDownlines(upline, SWEEP_THRESHOLDS.referralBurstThreshold, 45, 180)

    await sweep()
    await sweep()

    expect(await signalsFor(upline, 'referral_burst')).toBe(1)
  })
})

describe('FRAUD-2 — identical_timing memakai skala waktu manusia', () => {
  it('menandai pengerjaan yang simpangan bakunya jauh di bawah lantai manusia', async () => {
    const userId = await makeUser()
    await makeSolvedTasks(userId, SWEEP_THRESHOLDS.identicalTimingMinSample, {
      baseMs: 3_000,
      spreadMs: 100,
    })

    await sweep()

    expect(await signalsFor(userId, 'identical_timing')).toBe(1)
  })

  /**
   * Kasus yang paling menentukan: simpangan baku ~400ms lolos dari ambang lama 150ms,
   * padahal masih jauh di bawah lantai manusia paling konsisten di produksi (1.877ms).
   * Justru rentang inilah yang dulu jadi lubang.
   */
  it('menandai keseragaman yang dulu lolos dari ambang 150ms', async () => {
    const userId = await makeUser()
    await makeSolvedTasks(userId, SWEEP_THRESHOLDS.identicalTimingMinSample, {
      baseMs: 3_000,
      spreadMs: 800,
    })

    await sweep()

    expect(await signalsFor(userId, 'identical_timing')).toBe(1)
  })

  it('membiarkan sebaran sewajar produksi, yang dulu pun tidak tertangkap', async () => {
    const userId = await makeUser()
    await makeSolvedTasks(userId, SWEEP_THRESHOLDS.identicalTimingMinSample, {
      baseMs: 3_000,
      spreadMs: 3_800,
    })

    await sweep()

    expect(await signalsFor(userId, 'identical_timing')).toBe(0)
  })

  it('tidak menandai sampel yang terlalu sedikit untuk berarti', async () => {
    const userId = await makeUser()
    await makeSolvedTasks(userId, SWEEP_THRESHOLDS.identicalTimingMinSample - 1, {
      baseMs: 3_000,
      spreadMs: 100,
    })

    await sweep()

    expect(await signalsFor(userId, 'identical_timing')).toBe(0)
  })
})

describe('FRAUD-3 — no_wrong_attempts tidak bisa dimatikan satu jawaban salah', () => {
  it('tetap menandai walau ada satu percobaan salah yang disengaja', async () => {
    const userId = await makeUser()
    await makeSolvedTasks(userId, SWEEP_THRESHOLDS.noWrongMinSolved, {
      wrong: 1,
      spreadMs: 3_800,
    })

    await sweep()

    expect(await signalsFor(userId, 'no_wrong_attempts')).toBe(1)
  })

  it('membiarkan rasio salah sewajar populasi', async () => {
    const userId = await makeUser()
    const wajar = Math.ceil(SWEEP_THRESHOLDS.noWrongMinSolved * 0.065)
    await makeSolvedTasks(userId, SWEEP_THRESHOLDS.noWrongMinSolved, {
      wrong: wajar,
      spreadMs: 3_800,
    })

    await sweep()

    expect(await signalsFor(userId, 'no_wrong_attempts')).toBe(0)
  })

  it('mencatat rasionya supaya bisa ditinjau di panel', async () => {
    const { query } = await import('./db')
    const userId = await makeUser()
    await makeSolvedTasks(userId, SWEEP_THRESHOLDS.noWrongMinSolved, {
      wrong: 1,
      spreadMs: 3_800,
    })

    await sweep()

    const rows = await query<{ detail: { solved: number; salah: number; rasioSalah: string } }>(
      "select detail from fraud_signals where user_id=$1 and signal='no_wrong_attempts'",
      [userId],
    )
    expect(rows[0].detail.solved).toBe(SWEEP_THRESHOLDS.noWrongMinSolved)
    expect(rows[0].detail.salah).toBe(1)
    expect(Number(rows[0].detail.rasioSalah)).toBeLessThan(SWEEP_THRESHOLDS.noWrongMaxErrorRatio)
  })
})

describe('FRAUD-4 — rentang sapuan tidak boleh lebih pendek dari kadensi cron', () => {
  /**
   * Penjaga terhadap kelas bug yang membuat `referral_burst` tidak pernah menyala:
   * jendela 10 menit yang diperiksa sekali sejam hanya melihat 10 dari 60 menit. Kalau
   * jadwal cron diubah jadi lebih jarang, test ini yang harus gagal lebih dulu — bukan
   * detektornya yang diam-diam jadi buta.
   */
  it('menyisakan margin di atas periode cron di railway.cron.json', async () => {
    const raw = await readFile(path.join(process.cwd(), 'railway.cron.json'), 'utf8')
    const schedule = (JSON.parse(raw) as { deploy: { cronSchedule: string } }).deploy.cronSchedule

    expect(schedule).toBe('0 * * * *')
    expect(SWEEP_THRESHOLDS.referralBurstLookbackMinutes).toBeGreaterThanOrEqual(120)
    expect(SWEEP_THRESHOLDS.referralBurstLookbackMinutes).toBeGreaterThan(
      SWEEP_THRESHOLDS.referralBurstWindowMinutes,
    )
  })
})
