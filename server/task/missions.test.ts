import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'
import { missions, type MissionDefinition } from '@/domain/progression/missions'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

async function makeUser(energy = 0): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,energy,energy_updated_at)
     values($1,'Uji Misi',$2,$3,now()) returning id`,
    [String(900_000_000_000_000 + suffix), generateReferralCode(), energy],
  )
  return Number(rows[0].id)
}

async function completeTasks(userId: number, count: number, stars: number) {
  const { query } = await import('../platform/db')
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
  const { query } = await import('../platform/db')
  const rows = await query<{ energy: number }>('select energy from users where id=$1', [userId])
  return Number(rows[0].energy)
}

const tasksMission = missions().find((mission: MissionDefinition) => mission.key === 'tasks')!

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

    const { query } = await import('../platform/db')
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

  it('AUDIT-M1 — menolak klaim yang hadiahnya tidak muat utuh, bukan hanya saat energi penuh', async () => {
    const { claimMission } = await import('./missions')
    const { maxEnergy } = await import('@/domain/economy/energy')
    const { query } = await import('../platform/db')

    const ads = missions().find((mission: MissionDefinition) => mission.key === 'ads')
    if (!ads) throw new Error('misi ads hilang dari daftar')

    /** Satu energi di bawah kapasitas, dengan hadiah 3: bentuk lamanya meloloskan ini karena energinya belum PENUH, lalu `applyEnergyGrant` memotong di kapasitas. User diberi tahu 3, menerima 1, dan `mission_claims.energy_granted` menyimpan 3 — padahal migrasi 0031 mensyaratkan kolom itu mencatat yang benar-benar diberikan. Klaimnya habis untuk hari itu, jadi selisihnya hilang tanpa jejak. */
    const userId = await makeUser(maxEnergy() - 1)
    for (let index = 0; index < ads.target; index += 1) {
      await query(
        `insert into ad_views(user_id,block_id,expires_at,state,ready_at,consumed_at)
         values($1,'uji',now()+interval '1 hour','consumed',now(),now())`,
        [userId],
      )
    }

    expect(await claimMission(userId, 'ads')).toEqual({ ok: false, reason: 'energy_full' })
    expect(await readEnergyValue(userId)).toBe(maxEnergy() - 1)

    const claims = await query<{ mission_key: string }>(
      'select mission_key from mission_claims where user_id=$1',
      [userId],
    )
    expect(claims).toHaveLength(0)
  })

  it('AUDIT-M1 — membayar penuh begitu hadiahnya muat, dan mencatat angka yang sama', async () => {
    const { claimMission } = await import('./missions')
    const { maxEnergy } = await import('@/domain/economy/energy')
    const { query } = await import('../platform/db')

    const ads = missions().find((mission: MissionDefinition) => mission.key === 'ads')
    if (!ads) throw new Error('misi ads hilang dari daftar')

    const userId = await makeUser(maxEnergy() - ads.reward)
    for (let index = 0; index < ads.target; index += 1) {
      await query(
        `insert into ad_views(user_id,block_id,expires_at,state,ready_at,consumed_at)
         values($1,'uji',now()+interval '1 hour','consumed',now(),now())`,
        [userId],
      )
    }

    const claimed = await claimMission(userId, 'ads')
    expect(claimed).toMatchObject({ ok: true, energyGranted: ads.reward })
    expect(await readEnergyValue(userId)).toBe(maxEnergy())

    const stored = await query<{ energy_granted: number }>(
      'select energy_granted from mission_claims where user_id=$1',
      [userId],
    )
    expect(Number(stored[0].energy_granted)).toBe(ads.reward)
  })

  it('menolak kunci misi karangan', async () => {
    const { claimMission } = await import('./missions')
    const userId = await makeUser(0)

    expect(await claimMission(userId, 'kolam-gratis')).toEqual({
      ok: false,
      reason: 'unknown_mission',
    })
  })

  /** Misi yang sudah tidak diterbitkan tidak boleh tetap bisa diklaim lewat API. Targetnya masih terbaca di katalog, jadi tanpa penjagaan ini user yang syaratnya kebetulan sudah terpenuhi kemarin bisa memanen energi dari misi yang layarnya sendiri sudah tidak menampilkannya. */
  it('menolak klaim misi iklan setelah tombol mati iklan menyala', async () => {
    const { claimMission } = await import('./missions')
    const { missionDefinition } = await import('@/domain/progression/missions')
    const { query } = await import('../platform/db')
    const userId = await makeUser(0)

    for (let index = 0; index < missionDefinition('ads').target; index += 1) {
      await query(
        `insert into ad_views(user_id,block_id,expires_at,state,ready_at,consumed_at)
         values($1,'uji',now()+interval '1 hour','consumed',now(),now())`,
        [userId],
      )
    }

    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, adsMaxViewsPerDay: 0 })
    try {
      expect(await claimMission(userId, 'ads')).toEqual({
        ok: false,
        reason: 'unknown_mission',
      })
      expect(await readEnergyValue(userId)).toBe(0)
    } finally {
      setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
    }
  })
})
