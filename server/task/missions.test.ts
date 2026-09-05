import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'
import { ONCE_SOCIAL_MISSION_KEYS, missionDefinition } from '@/domain/progression/missions'

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

/** Diambil dari KATALOG, bukan dari daftar yang terbit hari itu: sejak misi otomatis diundi harian,
 * `missions()` belum tentu memuat `tasks`, dan test yang bergantung padanya akan lulus hari ini lalu
 * gagal besok tanpa ada yang rusak. */
const tasksMission = missionDefinition('tasks')

/** Undian misi harian berarti sebuah misi belum tentu terbit hari ini, dan klaim untuk misi yang
 * tidak terbit memang ditolak. Test di berkas ini menguji alur klaimnya, bukan undiannya, jadi
 * kolamnya dibuka penuh supaya semua misi tersedia berapa pun tanggal saat test dijalankan. */
beforeAll(async () => {
  const { setActiveEconomyConfig, economyConfig } = await import('@/domain/economy/economy-config')
  setActiveEconomyConfig({ ...economyConfig(), missionDailyCount: 6 })
})

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

    const ads = missionDefinition('ads')

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

    const ads = missionDefinition('ads')

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

  it('menolak misi sosial yang belum dibuka dan yang cooldown-nya belum selesai', async () => {
    const { claimMission, startMissionAction } = await import('./missions')
    const userId = await makeUser(0)

    expect(await claimMission(userId, 'twitter_post')).toEqual({
      ok: false,
      reason: 'action_required',
    })

    const started = await startMissionAction(userId, 'twitter_post')
    expect(started).toMatchObject({ ok: true })
    expect(await claimMission(userId, 'twitter_post')).toEqual({
      ok: false,
      reason: 'action_cooldown',
    })
  })

  it('memberi satu energi setelah cooldown server dan menolak klaim post kedua hari itu', async () => {
    const { claimMission, startMissionAction } = await import('./missions')
    const { query } = await import('../platform/db')
    const userId = await makeUser(0)

    await startMissionAction(userId, 'facebook_post')
    await query(
      `update social_mission_attempts
        set started_at=now()-interval '11 seconds'
        where user_id=$1 and mission_key='facebook_post'`,
      [userId],
    )

    const first = await claimMission(userId, 'facebook_post')
    expect(first).toMatchObject({ ok: true, energyGranted: 1 })
    expect(await readEnergyValue(userId)).toBe(1)
    expect(await claimMission(userId, 'facebook_post')).toEqual({
      ok: false,
      reason: 'already_claimed',
    })
  })

  it('menganggap follow yang pernah diklaim sebagai selesai untuk selamanya', async () => {
    const { claimMission, readMissions, startMissionAction } = await import('./missions')
    const { query } = await import('../platform/db')
    const userId = await makeUser(0)

    await startMissionAction(userId, 'twitter_follow')
    await query(
      `update social_mission_attempts
        set started_at=now()-interval '11 seconds'
        where user_id=$1 and mission_key='twitter_follow'`,
      [userId],
    )
    expect(await claimMission(userId, 'twitter_follow')).toMatchObject({ ok: true })

    await query(
      `update mission_claims
        set quota_date=(now() at time zone 'Asia/Jakarta')::date-1
        where user_id=$1 and mission_key='twitter_follow'`,
      [userId],
    )
    const follow = (await readMissions(userId)).find((mission) => mission.key === 'twitter_follow')
    expect(follow).toMatchObject({ claimed: true, cadence: 'once' })
    expect(await startMissionAction(userId, 'twitter_follow')).toEqual({
      ok: false,
      reason: 'already_claimed',
    })
  })

  it('menganggap Like & Retweet yang pernah diklaim sebagai selesai untuk selamanya', async () => {
    const { claimMission, readMissions, startMissionAction } = await import('./missions')
    const { query } = await import('../platform/db')
    const userId = await makeUser(0)

    await startMissionAction(userId, 'twitter_like_repost')
    await query(
      `update social_mission_attempts
        set started_at=now()-interval '11 seconds'
        where user_id=$1 and mission_key='twitter_like_repost'`,
      [userId],
    )
    expect(await claimMission(userId, 'twitter_like_repost')).toMatchObject({ ok: true })

    await query(
      `update mission_claims
        set quota_date=(now() at time zone 'Asia/Jakarta')::date-1
        where user_id=$1 and mission_key='twitter_like_repost'`,
      [userId],
    )
    const mission = (await readMissions(userId)).find(
      (item) => item.key === 'twitter_like_repost',
    )
    expect(mission).toMatchObject({ claimed: true, cadence: 'once' })
    expect(await startMissionAction(userId, 'twitter_like_repost')).toEqual({
      ok: false,
      reason: 'already_claimed',
    })
  })

  /** Berlaku untuk SETIAP misi sekali-seumur-akun, bukan satu per satu yang kebetulan sempat
   * ditulis. Daftar yang dipakai `CLAIMED_SQL` dan `isAlreadyClaimed` sekarang diturunkan dari
   * `cadence` di katalog, dan test inilah yang membuktikan penurunan itu benar-benar sampai ke
   * database. Bentuk lamanya menulis daftar itu tangan sebagai literal SQL: misi `once` yang luput
   * disalin ke sana terbit ulang begitu tanggal WIB bergeser, dan energinya bisa diklaim lagi dari
   * aksi yang sama — kebocoran harian yang tidak menggagalkan apa pun saat terjadi. */
  it.each([...ONCE_SOCIAL_MISSION_KEYS])(
    'menganggap %s selesai untuk selamanya, bukan cuma hari WIB itu',
    async (key) => {
      const { claimMission, readMissions, startMissionAction } = await import('./missions')
      const { query } = await import('../platform/db')
      const userId = await makeUser(0)

      await startMissionAction(userId, key)
      await query(
        `update social_mission_attempts
          set started_at=now()-interval '11 seconds'
          where user_id=$1 and mission_key=$2`,
        [userId, key],
      )
      expect(await claimMission(userId, key)).toMatchObject({ ok: true })

      await query(
        `update mission_claims
          set quota_date=(now() at time zone 'Asia/Jakarta')::date-1
          where user_id=$1 and mission_key=$2`,
        [userId, key],
      )

      const mission = (await readMissions(userId)).find((item) => item.key === key)
      expect(mission).toMatchObject({ claimed: true, cadence: 'once' })
      expect(await startMissionAction(userId, key)).toEqual({
        ok: false,
        reason: 'already_claimed',
      })
    },
  )

  it('menyimpan confirmAt yang sama saat aksi dimulai ulang dan memulihkannya setelah reload', async () => {
    const { readMissions, startMissionAction } = await import('./missions')
    const userId = await makeUser(0)

    const first = await startMissionAction(userId, 'twitter_post')
    const second = await startMissionAction(userId, 'twitter_post')
    expect(first).toMatchObject({ ok: true })
    expect(second).toMatchObject({ ok: true })
    if (!first.ok || !second.ok) throw new Error('aksi sosial gagal dimulai')

    expect(second.confirmAt).toBe(first.confirmAt)
    expect(first.confirmAt).toBeGreaterThan(first.serverNow)
    const reloaded = (await readMissions(userId)).find(
      (mission) => mission.key === 'twitter_post',
    )
    expect(reloaded?.confirmAt).toBe(first.confirmAt)
  })

  it('mengabaikan percobaan hari WIB sebelumnya', async () => {
    const { claimMission, readMissions, startMissionAction } = await import('./missions')
    const { query } = await import('../platform/db')
    const userId = await makeUser(0)

    await startMissionAction(userId, 'twitter_post')
    await query(
      `update social_mission_attempts
        set quota_date=(now() at time zone 'Asia/Jakarta')::date-1,
            started_at=now()-interval '1 day'
        where user_id=$1 and mission_key='twitter_post'`,
      [userId],
    )

    const expired = (await readMissions(userId)).find(
      (mission) => mission.key === 'twitter_post',
    )
    expect(expired?.confirmAt).toBeNull()
    expect(await claimMission(userId, 'twitter_post')).toEqual({
      ok: false,
      reason: 'action_required',
    })
  })

  it('mengunci dua klaim bersamaan agar energi hanya diberikan sekali', async () => {
    const { claimMission, startMissionAction } = await import('./missions')
    const { query } = await import('../platform/db')
    const userId = await makeUser(0)

    await startMissionAction(userId, 'facebook_post')
    await query(
      `update social_mission_attempts
        set started_at=now()-interval '11 seconds'
        where user_id=$1 and mission_key='facebook_post'`,
      [userId],
    )

    const results = await Promise.all([
      claimMission(userId, 'facebook_post'),
      claimMission(userId, 'facebook_post'),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, reason: 'already_claimed' },
    ])
    expect(await readEnergyValue(userId)).toBe(DEFAULT_ECONOMY_CONFIG.missionFacebookPostReward)

    const claims = await query<{ count: number }>(
      `select count(*)::int as count from mission_claims
        where user_id=$1 and mission_key='facebook_post'`,
      [userId],
    )
    expect(Number(claims[0].count)).toBe(1)
  })

  it('membayar empat reward sosial dari key masing-masing tanpa menyentuh credit ledger', async () => {
    const { claimMission, startMissionAction } = await import('./missions')
    const { query } = await import('../platform/db')
    const userId = await makeUser(0)
    setActiveEconomyConfig({
      ...DEFAULT_ECONOMY_CONFIG,
      missionTwitterFollowReward: 1,
      missionTwitterLikeRepostReward: 1,
      missionTwitterPostReward: 1,
      missionFacebookPostReward: 2,
    })

    const socialKeys = [
      'twitter_follow',
      'twitter_like_repost',
      'twitter_post',
      'facebook_post',
    ] as const

    try {
      for (const key of socialKeys) {
        await startMissionAction(userId, key)
      }
      await query(
        `update social_mission_attempts
          set started_at=now()-interval '11 seconds'
          where user_id=$1`,
        [userId],
      )

      for (const key of socialKeys) {
        expect(await claimMission(userId, key)).toMatchObject({ ok: true })
      }

      const grants = await query<{ mission_key: string; energy_granted: number }>(
        `select mission_key, energy_granted from mission_claims
          where user_id=$1 order by mission_key`,
        [userId],
      )
      expect(grants.map((row) => [row.mission_key, Number(row.energy_granted)])).toEqual([
        ['facebook_post', 2],
        ['twitter_follow', 1],
        ['twitter_like_repost', 1],
        ['twitter_post', 1],
      ])
      expect(await readEnergyValue(userId)).toBe(5)

      const ledger = await query<{ count: number }>(
        'select count(*)::int as count from credit_ledger where user_id=$1',
        [userId],
      )
      expect(Number(ledger[0].count)).toBe(0)
    } finally {
      setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
    }
  })
})
