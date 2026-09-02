import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMY_CONFIG,
  validateEconomyConfig,
  type EconomyConfig,
} from './economy-config'

/** Produksi mati total saat `withdrawalMinActiveReferrals` masuk ke kode sementara migrasinya belum dijalankan: baris tersimpan belum punya key itu, `loadEconomyConfig` menolak seluruh baris, dan setiap route yang memanggilnya menjawab 500 — layarnya berhenti di "Datanya nggak kebuka". Baris di bawah adalah bentuk konfigurasi produksi yang sesungguhnya saat itu. */
const PRODUKSI_TANPA_KEY_BARU = (() => {
  const config: Record<string, number> = { ...DEFAULT_ECONOMY_CONFIG }
  delete config.withdrawalMinActiveReferrals
  return config
})()

describe('ECON-7 — key baru yang belum termigrasi tidak boleh memadamkan API', () => {
  it('menolak baris yang kekurangan key saat dibaca ketat', () => {
    const result = validateEconomyConfig(PRODUKSI_TANPA_KEY_BARU)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.withdrawalMinActiveReferrals).toBeTruthy()
  })

  it('menerima baris itu saat dibaca dari database, dengan nilai bawaan', () => {
    const result = validateEconomyConfig(PRODUKSI_TANPA_KEY_BARU, { fillMissing: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.withdrawalMinActiveReferrals).toBe(
      DEFAULT_ECONOMY_CONFIG.withdrawalMinActiveReferrals,
    )
    expect(result.config.creditValueIdr).toBe(DEFAULT_ECONOMY_CONFIG.creditValueIdr)
  })

  it('tetap menolak nilai yang ada tapi rusak, bukan menggantinya diam-diam', () => {
    const rusak = { ...DEFAULT_ECONOMY_CONFIG, maxEnergy: -3 } as unknown as EconomyConfig

    expect(validateEconomyConfig(rusak, { fillMissing: true }).ok).toBe(false)
  })

  it('menyetel semua setelan admin apa adanya walau ada key yang hilang', () => {
    const disetelAdmin = {
      ...PRODUKSI_TANPA_KEY_BARU,
      rewardPoolCapIdr: 5_000,
      rewardPoolRegenMinutes: 6,
      rankPoolCapBonus: 10,
      maxStreakCapBonus: 10,
      maxTasksPerDay: 500,
      energyRegenMinutes: 10,
      premiumEnergyRegenMinutes: 5,
      premiumPoolCapBonus: 60,
      premiumMaxTasksPerDay: 800,
      rankTier2Tasks: 50,
      rankTier3Tasks: 150,
      rankTier4Tasks: 400,
      rankTier5Tasks: 1_000,
      dailyCommissionCapIdr: 10_000,
      maxPayoutIdr: 5_000_000,
      channelJoinBonusCredits: 10,
      textLengthMedium: 6,
      textLengthHard: 8,
      rewardMedium2: 4,
      rewardMedium3: 6,
    }
    const result = validateEconomyConfig(disetelAdmin, { fillMissing: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.energyRegenMinutes).toBe(10)
    expect(result.config.rewardPoolRegenMinutes).toBe(6)
    expect(result.config.withdrawalMinActiveReferrals).toBe(
      DEFAULT_ECONOMY_CONFIG.withdrawalMinActiveReferrals,
    )
  })
})
