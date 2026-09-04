import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from '@/domain/economy/economy-config'

/** Produksi pernah mati total karena migrasi 0027 menyemai nilai premium sebagai angka mati, sementara baris aslinya sudah lama disetel admin ke angka lain. Test ini menjalankan SQL migrasi 0028 yang sesungguhnya — dibaca dari disk, bukan disalin — lawan baris yang bentuknya sama dengan produksi saat itu. */
const REPAIR_SQL_PATH = path.join(
  process.cwd(),
  'db/migrations/0028_premium_seed_relative_to_base.sql',
)
const SOCIAL_REWARD_REPAIR_SQL_PATH = path.join(
  process.cwd(),
  'db/migrations/0045_social_mission_reward_keys.sql',
)

const PRODUKSI: EconomyConfig = {
  ...DEFAULT_ECONOMY_CONFIG,
  energyRegenMinutes: 10,
  maxTasksPerDay: 7_500,
}

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

afterEach(async () => {
  const { query } = await import('../platform/db')
  const { invalidateEconomyConfigCache, loadEconomyConfig } = await import('./economy-config')
  await query('update economy_config set config=$1::jsonb, version=1, updated_by=null where id=1', [
    JSON.stringify(DEFAULT_ECONOMY_CONFIG),
  ])
  invalidateEconomyConfigCache()
  await loadEconomyConfig()
})

async function writeConfig(config: EconomyConfig) {
  const { query } = await import('../platform/db')
  const { invalidateEconomyConfigCache } = await import('./economy-config')
  await query('update economy_config set config=$1::jsonb where id=1', [JSON.stringify(config)])
  invalidateEconomyConfigCache()
}

async function writeRawConfig(config: Record<string, number>) {
  const { query } = await import('../platform/db')
  const { invalidateEconomyConfigCache } = await import('./economy-config')
  await query('update economy_config set config=$1::jsonb where id=1', [JSON.stringify(config)])
  invalidateEconomyConfigCache()
}

async function runRepair() {
  const { query } = await import('../platform/db')
  const { invalidateEconomyConfigCache } = await import('./economy-config')
  await query(await readFile(REPAIR_SQL_PATH, 'utf8'))
  invalidateEconomyConfigCache()
}

async function runSocialRewardRepair() {
  const { query } = await import('../platform/db')
  const { invalidateEconomyConfigCache } = await import('./economy-config')
  await query(await readFile(SOCIAL_REWARD_REPAIR_SQL_PATH, 'utf8'))
  invalidateEconomyConfigCache()
}

const readStored = async (): Promise<EconomyConfig> => {
  const { query } = await import('../platform/db')
  const rows = await query<{ config: EconomyConfig }>('select config from economy_config where id=1')
  return rows[0].config
}

describe('ECON-6 — seed premium yang menabrak setelan admin memadamkan seluruh API', () => {
  it('menolak baris produksi yang disemai angka mati 0027', async () => {
    const { loadEconomyConfig } = await import('./economy-config')
    await writeConfig(PRODUKSI)

    await expect(loadEconomyConfig()).rejects.toMatchObject({
      code: 'ECONOMY_CONFIG_INVALID',
      status: 500,
    })
  })

  it('migrasi 0028 memulihkannya dan menurunkan nilainya dari nilai dasar baris itu', async () => {
    const { loadEconomyConfig } = await import('./economy-config')
    await writeConfig(PRODUKSI)
    await runRepair()

    const loaded = await loadEconomyConfig()
    expect(loaded.premiumEnergyRegenMinutes).toBe(5)
    expect(loaded.premiumMaxTasksPerDay).toBe(15_000)

    expect(loaded.premiumEnergyRegenMinutes).toBeLessThanOrEqual(loaded.energyRegenMinutes)
    expect(loaded.premiumMaxTasksPerDay).toBeGreaterThanOrEqual(loaded.maxTasksPerDay)
    expect(loaded.premiumMaxEnergy).toBeGreaterThanOrEqual(loaded.maxEnergy)
  })

  it('tidak menggeser satu pun nilai pada konfigurasi bawaan', async () => {
    await writeConfig(DEFAULT_ECONOMY_CONFIG)
    await runRepair()

    expect(await readStored()).toEqual(DEFAULT_ECONOMY_CONFIG)
  })

  it('tidak pernah memperlemah setelan premium yang sudah sengaja diubah admin', async () => {
    const disetel: EconomyConfig = {
      ...PRODUKSI,
      premiumEnergyRegenMinutes: 2,
      premiumMaxTasksPerDay: 90_000,
      premiumMaxEnergy: 10,
    }
    await writeConfig(disetel)
    await runRepair()

    const stored = await readStored()
    expect(stored.premiumEnergyRegenMinutes).toBe(2)
    expect(stored.premiumMaxTasksPerDay).toBe(90_000)
  })

  it('tetap lolos validasi saat batas dasarnya berada di ujung rentangnya', async () => {
    const { loadEconomyConfig } = await import('./economy-config')
    await writeConfig({
      ...DEFAULT_ECONOMY_CONFIG,
      maxTasksPerDay: 100_000,
      maxEnergy: 10,
      energyCostPerTask: 1,
      energyRegenMinutes: 1,
    })
    await runRepair()

    const loaded = await loadEconomyConfig()
    expect(loaded.premiumMaxTasksPerDay).toBe(100_000)
    expect(loaded.premiumEnergyRegenMinutes).toBe(1)
    expect(loaded.premiumMaxEnergy).toBe(10)
  })
})

describe('ECON-7 — reward sosial lama dipisah menjadi tiga key runtime', () => {
  it('menyalin key lama ke tiga reward dan menghapus key yatim', async () => {
    const legacy = { ...DEFAULT_ECONOMY_CONFIG } as Record<string, number>
    delete legacy.missionTwitterFollowReward
    delete legacy.missionTwitterPostReward
    delete legacy.missionFacebookPostReward
    legacy.missionSocialReward = 4
    await writeRawConfig(legacy)

    await runSocialRewardRepair()

    const stored = (await readStored()) as EconomyConfig & Record<string, number>
    expect(stored.missionTwitterFollowReward).toBe(4)
    expect(stored.missionTwitterPostReward).toBe(4)
    expect(stored.missionFacebookPostReward).toBe(4)
    expect(stored.missionSocialReward).toBeUndefined()
  })

  it('mempertahankan key yang sudah diubah admin dan membatasi fallback ke kapasitas energi', async () => {
    const partial = { ...DEFAULT_ECONOMY_CONFIG } as Record<string, number>
    delete partial.missionTwitterPostReward
    delete partial.missionFacebookPostReward
    partial.maxEnergy = 3
    partial.missionTwitterFollowReward = 2
    partial.missionSocialReward = 5
    await writeRawConfig(partial)

    await runSocialRewardRepair()

    const stored = await readStored()
    expect(stored.missionTwitterFollowReward).toBe(2)
    expect(stored.missionTwitterPostReward).toBe(3)
    expect(stored.missionFacebookPostReward).toBe(3)
  })
})
