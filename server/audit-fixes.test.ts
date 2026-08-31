import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy-config'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

async function makeUser(balance = 0): Promise<number> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits)
     values($1,'Uji Audit',$2,$3) returning id`,
    [String(900_000_000_000_000 + suffix), generateReferralCode(), balance],
  )
  return Number(rows[0].id)
}

const tasksToday = async (userId: number) => {
  const { query } = await import('./db')
  const rows = await query<{ tasks_completed: number }>(
    `select tasks_completed from daily_quotas
      where user_id=$1 and quota_date=(now() at time zone 'Asia/Jakarta')::date`,
    [userId],
  )
  return rows[0] ? Number(rows[0].tasks_completed) : 0
}

describe('AUDIT-1 — plafon harian tidak menghitung task yang tidak dibayar', () => {
  it('mengembalikan penghitung saat kolam kosong', async () => {
    const { transaction, query } = await import('./db')
    const { consumeQuota } = await import('./quota')
    const userId = await makeUser()
    await query('update users set reward_pool=0, reward_pool_updated_at=now() where id=$1', [
      userId,
    ])

    const result = await transaction((tx) => consumeQuota(tx, userId, 3))

    expect(result.refusal).toBe('pool_empty')
    expect(result.paidReward).toBe(0)
    expect(await tasksToday(userId)).toBe(0)
  })

  it('tetap menghitung task yang benar-benar dibayar', async () => {
    const { transaction, query } = await import('./db')
    const { consumeQuota } = await import('./quota')
    const userId = await makeUser()
    await query('update users set reward_pool=10, reward_pool_updated_at=now() where id=$1', [
      userId,
    ])

    const result = await transaction((tx) => consumeQuota(tx, userId, 3))

    expect(result.refusal).toBeNull()
    expect(result.paidReward).toBe(3)
    expect(await tasksToday(userId)).toBe(1)
  })
})

describe('AUDIT-2 — syarat referral penarikan datang dari panel admin', () => {
  it('nol membuka penarikan untuk user tanpa referral sama sekali', async () => {
    const { requiredActiveReferrals } = await import('./payout-rules')

    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, withdrawalMinActiveReferrals: 0 })
    expect(requiredActiveReferrals()).toBe(0)

    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, withdrawalMinActiveReferrals: 5 })
    expect(requiredActiveReferrals()).toBe(5)
    setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
  })

  it('user tanpa referral bisa menarik setelah cukup hari aktif', async () => {
    const { query } = await import('./db')
    const { createPayout } = await import('./payout')
    const { REQUIRED_ACTIVE_DAYS } = await import('./payout-rules')
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, withdrawalMinActiveReferrals: 0 })

    const userId = await makeUser(500)
    for (let day = 1; day <= REQUIRED_ACTIVE_DAYS; day++) {
      const challengeId = (await query<{ id: string }>('select gen_random_uuid() id'))[0].id
      await query(
        `insert into challenges(id,user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,started_at,submitted_at,solved)
         values($1,$2,'text','Easy','{}'::jsonb,decode('00','hex'),3,now(),now(),now(),true)`,
        [challengeId, userId],
      )
      await query(
        `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
         values($1,$2,'text','Easy',5000,3,1, now() - ($3::int * interval '1 day'))`,
        [userId, challengeId, day],
      )
    }

    const created = await createPayout(userId, {
      channelId: 'bca',
      accountNumber: String(1_000_000_000 + Math.floor(Math.random() * 899_999_999)),
      accountName: 'Uji Audit',
      credits: 100,
    })

    expect(Number(created.withdrawal.credits)).toBe(100)
    setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
  })
})
