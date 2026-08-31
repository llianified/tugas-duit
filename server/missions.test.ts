import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy-config'
import { MISSIONS } from '@/domain/missions'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

async function makeUser(energy = 0): Promise<number> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,energy,energy_updated_at)
     values($1,'Uji Misi',$2,$3,now()) returning id`,
    [String(900_000_000_000_000 + suffix), generateReferralCode(), energy],
  )
  return Number(rows[0].id)
}

async function completeTasks(userId: number, count: number, stars: number) {
  const { query } = await import('./db')
  for (let index = 0; index < count; index += 1) {
    const challengeId = (await query<{ id: string }>('select gen_random_uuid() id'))[0].id
    await query(
      `insert into challenges(id,user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,started_at,submitted_at,solved)
       values($1,$2,'text','Easy','{}'::jsonb,decode('00','hex'),3,now(),now(),now(),true)`,
      [challengeId, userId],
    )
    await query(
      `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward)
       values($1,$2,'text','Easy',5000,$3,1)`,
      [userId, challengeId, stars],
    )
  }
}

const readEnergyValue = async (userId: number) => {
  const { query } = await import('./db')
  const rows = await query<{ energy: number }>('select energy from users where id=$1', [userId])
  return Number(rows[0].energy)
}

const tasksMission = MISSIONS.find((mission) => mission.key === 'tasks')!

describe('MISI-1 — hadiah misi adalah energi, dan hanya sekali per hari', () => {
  it('menolak klaim untuk misi yang belum kelar', async () => {
    const { claimMission } = await import('./missions')
    const userId = await makeUser(0)
    await completeTasks(userId, tasksMission.target - 1, 3)

    expect(await claimMission(userId, 'tasks')).toEqual({ ok: false, reason: 'not_done' })
    expect(await readEnergyValue(userId)).toBe(0)
  })

  it('memberi energi sekali, lalu menolak klaim kedua', async () => {
    const { claimMission } = await import('./missions')
    const userId = await makeUser(0)
    await completeTasks(userId, tasksMission.target, 3)

    const first = await claimMission(userId, 'tasks')
    expect(first).toMatchObject({ ok: true, energyGranted: tasksMission.reward })
    expect(await readEnergyValue(userId)).toBe(tasksMission.reward)

    expect(await claimMission(userId, 'tasks')).toEqual({
      ok: false,
      reason: 'already_claimed',
    })
    expect(await readEnergyValue(userId)).toBe(tasksMission.reward)
  })

  it('menolak saat energi penuh, bukan membuang hadiahnya diam-diam', async () => {
    const { claimMission } = await import('./missions')
    const userId = await makeUser(DEFAULT_ECONOMY_CONFIG.maxEnergy)
    await completeTasks(userId, tasksMission.target, 3)

    expect(await claimMission(userId, 'tasks')).toEqual({ ok: false, reason: 'energy_full' })

    const { query } = await import('./db')
    const claims = await query<{ jumlah: number }>(
      'select count(*)::int as jumlah from mission_claims where user_id=$1',
      [userId],
    )
    expect(Number(claims[0].jumlah)).toBe(0)
  })

  it('menghitung bintang tiga terpisah dari jumlah task', async () => {
    const { readMissions } = await import('./missions')
    const userId = await makeUser(0)
    await completeTasks(userId, 4, 1)

    const missions = await readMissions(userId)
    const tasks = missions.find((mission) => mission.key === 'tasks')
    const stars = missions.find((mission) => mission.key === 'stars')

    expect(tasks?.progress).toBe(4)
    expect(stars?.progress).toBe(0)
  })

  it('menolak kunci misi karangan', async () => {
    const { claimMission } = await import('./missions')
    const userId = await makeUser(0)

    expect(await claimMission(userId, 'kolam-gratis')).toEqual({
      ok: false,
      reason: 'unknown_mission',
    })
  })
})
