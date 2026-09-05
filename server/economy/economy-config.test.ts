import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from '@/domain/economy/economy-config'

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
  await query('delete from economy_config_audit')
  invalidateEconomyConfigCache()
  await loadEconomyConfig()
})

async function makeUser(isAdmin: boolean): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,is_admin,balance_credits)
     values($1,'Uji',$2,$3,500) returning id`,
    [500_000_000_000_000 + suffix, generateReferralCode(), isAdmin],
  )
  return Number(rows[0].id)
}

const patched = (patch: Partial<EconomyConfig>) => ({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

describe('default di database', () => {
  it('baris yang disemai migrasi sama persis dengan DEFAULT_ECONOMY_CONFIG', async () => {
    const { query } = await import('../platform/db')
    const rows = await query<{ config: EconomyConfig }>('select config from economy_config where id=1')
    expect(rows[0].config).toEqual(DEFAULT_ECONOMY_CONFIG)
  })

  it('loadEconomyConfig memasangnya untuk seluruh modul domain', async () => {
    const { loadEconomyConfig } = await import('./economy-config')
    const { economyConfig } = await import('@/domain/economy/economy-config')
    const loaded = await loadEconomyConfig()
    expect(loaded).toEqual(DEFAULT_ECONOMY_CONFIG)
    expect(economyConfig()).toEqual(DEFAULT_ECONOMY_CONFIG)
  })
})

describe('otorisasi', () => {
  it('menolak user biasa', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const userId = await makeUser(false)
    await expect(
      updateEconomyConfig(userId, patched({ rewardPoolCapIdr: 9_000 }), 1),
    ).rejects.toMatchObject({ code: 'ECONOMY_CONFIG_FORBIDDEN', status: 403 })
  })

  it('menolak admin yang sedang ditangguhkan', async () => {
    const { query } = await import('../platform/db')
    const { updateEconomyConfig } = await import('./economy-config')
    const adminId = await makeUser(true)
    await query('update users set banned_at=now() where id=$1', [adminId])
    await expect(
      updateEconomyConfig(adminId, patched({ rewardPoolCapIdr: 9_000 }), 1),
    ).rejects.toMatchObject({ code: 'ECONOMY_CONFIG_FORBIDDEN' })
  })

  it('menerima admin', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const adminId = await makeUser(true)
    const result = await updateEconomyConfig(adminId, patched({ rewardPoolCapIdr: 9_000 }), 1)
    expect(result.snapshot.config.rewardPoolCapIdr).toBe(9_000)
    expect(result.snapshot.version).toBe(2)
  })

  it('konfigurasi yang tidak valid ditolak walau pengirimnya admin', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const adminId = await makeUser(true)
    await expect(
      updateEconomyConfig(adminId, patched({ rewardHard3: -5 }), 1),
    ).rejects.toMatchObject({ code: 'ECONOMY_CONFIG_INVALID', status: 400 })
  })
})

describe('jejak audit', () => {
  it('mencatat satu baris per field yang berubah, bukan per penyimpanan', async () => {
    const { query } = await import('../platform/db')
    const { updateEconomyConfig } = await import('./economy-config')
    const adminId = await makeUser(true)

    await updateEconomyConfig(adminId, patched({ rewardPoolCapIdr: 9_000, maxEnergy: 7 }), 1)

    const rows = await query<{ field: string; old_value: string; new_value: string; version: number; changed_by: string }>(
      'select field, old_value, new_value, version, changed_by from economy_config_audit order by field',
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.field)).toEqual(['maxEnergy', 'rewardPoolCapIdr'])
    expect(rows[1]).toMatchObject({ old_value: '3000', new_value: '9000', version: 2 })
    expect(Number(rows[1].changed_by)).toBe(adminId)
  })

  it('penyimpanan tanpa perubahan tidak menulis baris audit', async () => {
    const { query } = await import('../platform/db')
    const { updateEconomyConfig } = await import('./economy-config')
    const adminId = await makeUser(true)
    await updateEconomyConfig(adminId, { ...DEFAULT_ECONOMY_CONFIG }, 1)
    const rows = await query('select 1 from economy_config_audit')
    expect(rows).toHaveLength(0)
  })
})

describe('penyimpanan bersamaan', () => {
  it('penyimpanan kedua dengan versi basi ditolak, bukan menimpa diam-diam', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const first = await makeUser(true)
    const second = await makeUser(true)

    await updateEconomyConfig(first, patched({ rewardPoolCapIdr: 9_000 }), 1)
    await expect(
      updateEconomyConfig(second, patched({ rewardPoolCapIdr: 12_000 }), 1),
    ).rejects.toMatchObject({ code: 'ECONOMY_CONFIG_CONFLICT', status: 409 })

    const { loadEconomyConfig, invalidateEconomyConfigCache } = await import('./economy-config')
    invalidateEconomyConfigCache()
    expect((await loadEconomyConfig()).rewardPoolCapIdr).toBe(9_000)
  })
})

describe('cache dan invalidasi', () => {
  it('perubahan berlaku seketika di proses yang menyimpannya', async () => {
    const { updateEconomyConfig, loadEconomyConfig } = await import('./economy-config')
    const adminId = await makeUser(true)
    await loadEconomyConfig()

    await updateEconomyConfig(adminId, patched({ creditValueIdr: 250 }), 1)

    expect((await loadEconomyConfig()).creditValueIdr).toBe(250)
  })

  it('pembacaan berikutnya di dalam TTL tidak mengambil nilai lain', async () => {
    const { loadEconomyConfig } = await import('./economy-config')
    const a = await loadEconomyConfig()
    const b = await loadEconomyConfig()
    expect(a).toEqual(b)
  })
})

describe('konsumen membaca dari satu sumber kebenaran', () => {
  it('reward task mengikuti tabel yang disetel', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const { getStarReward, getMaxReward } = await import('@/domain/progression/stars')
    const adminId = await makeUser(true)

    expect(getStarReward('Hard', 3)).toBe(9)
    await updateEconomyConfig(adminId, patched({ rewardHard3: 12 }), 1)
    expect(getStarReward('Hard', 3)).toBe(12)
    expect(getMaxReward('Hard')).toBe(12)
  })

  it('kapasitas kolam reward mengikuti kapasitas dasar dan bonus rank yang disetel', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const { rewardPoolCapacity } = await import('@/domain/economy/reward-pool')
    const adminId = await makeUser(true)

    expect(rewardPoolCapacity({ rankTier: 1, streak: 0 })).toBe(30)
    await updateEconomyConfig(adminId, patched({ rewardPoolCapIdr: 5_000, rankPoolCapBonus: 10 }), 1)
    expect(rewardPoolCapacity({ rankTier: 1, streak: 0 })).toBe(50)
    expect(rewardPoolCapacity({ rankTier: 3, streak: 0 })).toBe(70)
  })

  it('laju isi ulang kolam mengikuti interval dan langkah yang disetel', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const { rewardPoolRegenMs, rewardPoolCreditsPerDay } = await import('@/domain/economy/reward-pool')
    const adminId = await makeUser(true)

    expect(rewardPoolRegenMs()).toBe(2_880_000)
    expect(rewardPoolCreditsPerDay()).toBe(30)
    await updateEconomyConfig(
      adminId,
      patched({ rewardPoolRegenMinutes: 24, rewardPoolRegenCredits: 2 }),
      1,
    )
    expect(rewardPoolRegenMs()).toBe(1_440_000)
    expect(rewardPoolCreditsPerDay()).toBe(120)
  })

  it('energi mengikuti kapasitas dan interval yang disetel', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const { maxEnergy, energyRegenMs } = await import('@/domain/economy/energy')
    const adminId = await makeUser(true)

    expect(maxEnergy()).toBe(5)
    expect(energyRegenMs()).toBe(3_600_000)
    await updateEconomyConfig(adminId, patched({ maxEnergy: 8, energyRegenMinutes: 30 }), 1)
    expect(maxEnergy()).toBe(8)
    expect(energyRegenMs()).toBe(1_800_000)
  })

  it('komisi referral mengikuti persentase yang disetel', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const { commissionUnitsForReward } = await import('@/domain/economy/referral')
    const adminId = await makeUser(true)

    expect(commissionUnitsForReward(10)).toBe(100)
    await updateEconomyConfig(
      adminId,
      patched({ referralCommissionPercent: 20, premiumReferralCommissionPercent: 30 }),
      1,
    )
    expect(commissionUnitsForReward(10)).toBe(200)
    /** Upline premium dibayar dari lajunya sendiri. Keduanya dibaca dari config yang sama, jadi
     * satu-satunya cara selisih ini hilang diam-diam adalah kalau pemanggilnya lupa mengoper
     * premium — dan itu yang dijaga di sini, bukan aritmetikanya. */
    expect(commissionUnitsForReward(10, true)).toBe(300)
  })

  it('minimum dan maksimum penarikan mengikuti nominal yang disetel', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const { withdrawalMinimumCredits, maxPayoutCredits } = await import('@/domain/economy/economy')
    const adminId = await makeUser(true)

    expect(withdrawalMinimumCredits()).toBe(100)
    await updateEconomyConfig(adminId, patched({ withdrawalMinimumIdr: 25_000 }), 1)
    expect(withdrawalMinimumCredits()).toBe(250)
    expect(maxPayoutCredits()).toBe(20_000_000)
  })

  it('createPayout menolak nominal di bawah minimum yang baru disetel', async () => {
    const { updateEconomyConfig } = await import('./economy-config')
    const { createPayout } = await import('../payout/payout')
    const adminId = await makeUser(true)
    const userId = await makeUser(false)

    await updateEconomyConfig(adminId, patched({ withdrawalMinimumIdr: 40_000 }), 1)
    await expect(
      createPayout(userId, {
        channelId: 'dana',
        accountNumber: `08${String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0')}`,
        accountName: 'Uji Coba',
        credits: 100,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })
})

describe('ECON-6 — route yang menghitung dengan config wajib memuatnya dulu', () => {
  /** `economyConfig()` adalah state global proses yang baru terpasang setelah `loadEconomyConfig()` (lihat `docs/keputusan-desain.md`). Route yang melewatkannya tetap jalan — dan itu masalahnya: di instance yang dingin ia diam-diam memakai `DEFAULT_ECONOMY_CONFIG`, bukan yang tersimpan. `PATCH /api/admin/users/[publicId]` sempat begitu, jadi hibah energi dijepit `maxEnergy()` bawaan dan isi ulang kolam dijepit kapasitas bawaan, sementara baris audit `admin_actions` ikut mencatat kapasitas yang salah. Kesalahannya tidak deterministik — tergantung apakah instance-nya sudah pernah melayani route lain — jadi ia tidak akan pernah muncul di satu jalan uji manual. */
  it('tidak menyisakan route hibah tanpa loadEconomyConfig', async () => {
    const root = path.join(process.cwd(), 'app/api')
    const entries = await readdir(root, { recursive: true })
    const routes = entries.filter((entry) => entry.endsWith('route.ts')).sort()

    expect(routes.length).toBeGreaterThan(20)

    const tanpaConfig: string[] = []
    for (const relative of routes) {
      const source = await readFile(path.join(root, relative), 'utf8')
      const menghitungDenganConfig =
        source.includes('admin-grants') ||
        source.includes('grantUserEnergy') ||
        source.includes('refillUserRewardPool')
      if (menghitungDenganConfig && !source.includes('loadEconomyConfig')) {
        tanpaConfig.push(relative)
      }
    }

    expect(tanpaConfig).toEqual([])
  })
})
