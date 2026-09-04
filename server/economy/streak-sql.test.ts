import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

async function makeUser(): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code) values($1,$2,$3) returning id`,
    [600_000_000_000_000 + suffix, 'Uji', generateReferralCode()],
  )
  return Number(rows[0].id)
}

async function completeTaskDaysAgo(userId: number, daysAgo: number) {
  const { query } = await import('../platform/db')
  const rows = await query<{ id: string }>(
    `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,submitted_at,solved)
     values($1,'text','Easy','{}'::jsonb,'\\x00'::bytea,3,now(),now(),true) returning id`,
    [userId],
  )
  await query(
    `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
     values($1,$2,'text','Easy',1000,3,3,
       ((now() at time zone 'Asia/Jakarta')::date - $3::int) at time zone 'Asia/Jakarta')`,
    [userId, rows[0].id, daysAgo],
  )
}

/** Streak sekarang masuk lewat kapasitas kolam reward, jadi jalur SQL-nya dibaca dari sana: bonus streak = kapasitas terbaca − kapasitas dasar, karena user uji belum menembus rank apa pun. */
async function streakBonusFromPool(userId: number): Promise<number> {
  const { readRewardPoolCapacity } = await import('./reward-pool')
  const { baseRewardPoolCredits } = await import('@/domain/economy/reward-pool')
  return (await readRewardPoolCapacity(userId)) - baseRewardPoolCredits()
}

async function streakFromStats(userId: number): Promise<number> {
  const { getStats } = await import('../task/stats')
  return (await getStats(userId, 0)).streak
}

describe('ECON-10 — streak reward-pool.ts vs stats.ts', () => {
  it('sepakat untuk user tanpa riwayat sama sekali', async () => {
    const userId = await makeUser()
    expect(await streakFromStats(userId)).toBe(1)
    expect(await streakBonusFromPool(userId)).toBe(0)
  })

  it('sepakat untuk rentetan yang menembus ambang bonus tujuh hari', async () => {
    const userId = await makeUser()
    for (let day = 1; day <= 6; day++) await completeTaskDaysAgo(userId, day)

    expect(await streakFromStats(userId)).toBe(7)
    expect(await streakBonusFromPool(userId)).toBe(1)
  })

  it('sepakat bahwa rentetan yang bolong tidak dihitung', async () => {
    const userId = await makeUser()
    for (const day of [2, 3, 4, 5, 6, 7]) await completeTaskDaysAgo(userId, day)

    expect(await streakFromStats(userId)).toBe(1)
    expect(await streakBonusFromPool(userId)).toBe(0)
  })

  /** `CAPACITY_SQL` hanya memindai hari aktif di dalam jendela yang masih bisa menggeser bonus,
   * bukan seluruh umur akun. Rentetan yang jauh lebih panjang dari jendela itu harus tetap
   * membaca bonus maksimum — kalau tidak, penghematannya dibayar dengan hasil yang salah. */
  it('tetap membaca bonus maksimum untuk rentetan yang jauh melampaui jendelanya', async () => {
    const { economyConfig } = await import('@/domain/economy/economy-config')
    const { maxStreakCapBonus, streakCapStepDays } = economyConfig()
    const userId = await makeUser()
    for (let day = 1; day <= maxStreakCapBonus * streakCapStepDays * 2; day++) {
      await completeTaskDaysAgo(userId, day)
    }

    expect(await streakBonusFromPool(userId)).toBe(maxStreakCapBonus)
  })
})
