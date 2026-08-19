import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMY_CONFIG,
  ECONOMY_FIELDS,
  economyConfig,
  setActiveEconomyConfig,
  validateEconomyConfig,
  type EconomyConfig,
} from './economy-config'

const HISTORIC: EconomyConfig = {
  creditValueIdr: 100, rewardPoolCapIdr: 3_000, rewardPoolRegenMinutes: 48,
  rewardPoolRegenCredits: 1, rankPoolCapBonus: 3, streakCapStepDays: 7,
  maxStreakCapBonus: 4, maxTasksPerDay: 300,
  maxAttemptsPerTask: 3, taskWindowSeconds: 300, star2ParMultiplier: 2,
  textLengthEasy: 4, textLengthMedium: 5, textLengthHard: 6,
  mathDigitsEasy: 2, mathDigitsMedium: 2, mathDigitsHard: 3,
  mathCeilingEasy: 30, mathCeilingMedium: 99, mathCeilingHard: 400,
  selectOptionsEasy: 4, selectOptionsMedium: 6, selectOptionsHard: 9,
  parTimeEasyMs: 10_000, parTimeMediumMs: 18_000,
  parTimeHardMs: 28_000, rewardEasy1: 1, rewardEasy2: 2, rewardEasy3: 3, rewardMedium1: 2,
  rewardMedium2: 3, rewardMedium3: 5, rewardHard1: 3, rewardHard2: 6, rewardHard3: 9,
  maxEnergy: 5, energyRegenMinutes: 60, energyCostPerTask: 1,
  adsMaxViewsPerDay: 10, adsCooldownSeconds: 120,
  adsTicketTtlSeconds: 300, adsPassTtlMinutes: 30,
  withdrawalMinimumIdr: 10_000,
  maxPayoutIdr: 2_000_000_000, referralCommissionPercent: 10, dailyCommissionCapIdr: 6_000,
  rankTier2Tasks: 100, rankTier3Tasks: 300, rankTier4Tasks: 700, rankTier5Tasks: 1_500,
}

const withField = (patch: Partial<EconomyConfig>) => ({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

describe('default config', () => {
  it('terpaku pada snapshot yang sudah ditinjau, supaya pergeseran diam-diam gagal di sini', () => {
    expect(DEFAULT_ECONOMY_CONFIG).toEqual(HISTORIC)
  })

  it('punya metadata untuk setiap field, dan tidak ada metadata tanpa field', () => {
    const fieldKeys = ECONOMY_FIELDS.map((f) => f.key).sort()
    expect(fieldKeys).toEqual(Object.keys(DEFAULT_ECONOMY_CONFIG).sort())
  })

  it('nilai bawaan sendiri lolos validasi', () => {
    expect(validateEconomyConfig(DEFAULT_ECONOMY_CONFIG).ok).toBe(true)
  })

  it('setiap bawaan berada di dalam rentangnya sendiri', () => {
    for (const field of ECONOMY_FIELDS) {
      const value = DEFAULT_ECONOMY_CONFIG[field.key]
      expect(value).toBeGreaterThanOrEqual(field.min)
      expect(value).toBeLessThanOrEqual(field.max)
    }
  })

  it('arah risiko sejalan dengan kalimat dampaknya', () => {
    const menyimpang = ECONOMY_FIELDS.filter((field) => {
      if (field.riskyWhen === 'never') return false
      if (field.impact.startsWith('Menaikkannya')) return field.riskyWhen !== 'higher'
      if (field.impact.startsWith('Menurunkannya')) return field.riskyWhen !== 'lower'
      return false
    }).map((field) => field.key)

    expect(menyimpang).toEqual([])
  })
})

describe('validation — nilai absurd ditolak', () => {
  const rejects = (patch: Partial<EconomyConfig>, key: string) => {
    const result = validateEconomyConfig(withField(patch))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors)).toContain(key)
  }

  it('reward negatif', () => rejects({ rewardHard3: -1 }, 'rewardHard3'))
  it('reward nol', () => rejects({ rewardEasy1: 0 }, 'rewardEasy1'))
  it('reward di atas plafon kewarasan', () => rejects({ rewardHard3: 5_000 }, 'rewardHard3'))
  it('energi negatif', () => rejects({ maxEnergy: -3 }, 'maxEnergy'))
  it('energi di atas batas constraint database', () => rejects({ maxEnergy: 50 }, 'maxEnergy'))
  it('regen nol detik', () => rejects({ energyRegenMinutes: 0 }, 'energyRegenMinutes'))
  it('komisi di atas 100%', () => rejects({ referralCommissionPercent: 150 }, 'referralCommissionPercent'))
  it('komisi negatif', () => rejects({ referralCommissionPercent: -5 }, 'referralCommissionPercent'))
  it('minimum penarikan nol', () => rejects({ withdrawalMinimumIdr: 0 }, 'withdrawalMinimumIdr'))
  it('payout tanpa batas', () => rejects({ maxPayoutIdr: 99_000_000_000 }, 'maxPayoutIdr'))
  it('kapasitas kolam ekstrem', () => rejects({ rewardPoolCapIdr: 50_000_000 }, 'rewardPoolCapIdr'))
  it('isi ulang kolam nol menit', () =>
    rejects({ rewardPoolRegenMinutes: 0 }, 'rewardPoolRegenMinutes'))
  it('isi ulang kolam nol credit', () =>
    rejects({ rewardPoolRegenCredits: 0 }, 'rewardPoolRegenCredits'))
  it('nilai pecahan', () => rejects({ creditValueIdr: 10.5 }, 'creditValueIdr'))
  it('bukan angka', () => {
    const result = validateEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, maxEnergy: '5' })
    expect(result.ok).toBe(false)
  })
  it('bukan objek', () => expect(validateEconomyConfig(null).ok).toBe(false))
})

describe('validation — aturan antar-field', () => {
  it('menolak biaya energi per task yang melampaui kapasitas energi', () => {
    const result = validateEconomyConfig(withField({ maxEnergy: 3, energyCostPerTask: 5 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.energyCostPerTask).toBeTruthy()
  })

  it('menerima biaya energi yang persis sebesar kapasitasnya', () => {
    expect(validateEconomyConfig(withField({ maxEnergy: 3, energyCostPerTask: 3 })).ok).toBe(true)
  })

  it('menolak nominal Rupiah yang tidak habis dibagi kurs', () => {
    const result = validateEconomyConfig(withField({ creditValueIdr: 700 }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.withdrawalMinimumIdr).toBeTruthy()
    }
  })

  it('menerima kurs baru yang seluruh turunannya tetap bulat', () => {
    expect(
      validateEconomyConfig(
        withField({
          creditValueIdr: 200,
          withdrawalMinimumIdr: 10_000,
          maxPayoutIdr: 2_000_000_000,
          rewardPoolCapIdr: 3_000,
          dailyCommissionCapIdr: 6_000,
        }),
      ).ok,
    ).toBe(true)
  })

  it('menolak reward yang turun dari 1★ ke 3★', () => {
    const result = validateEconomyConfig(withField({ rewardHard1: 9, rewardHard3: 3 }))
    expect(result.ok).toBe(false)
  })

  it('menolak ambang rank yang tidak menaik', () => {
    const result = validateEconomyConfig(withField({ rankTier3Tasks: 50 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.rankTier3Tasks).toBeTruthy()
  })

  it('menolak maksimum penarikan di bawah minimumnya', () => {
    const result = validateEconomyConfig(
      withField({ withdrawalMinimumIdr: 500_000, maxPayoutIdr: 100_000 }),
    )
    expect(result.ok).toBe(false)
  })

  it('menolak kombinasi yang melampaui batas kolom credits di database', () => {
    const result = validateEconomyConfig(
      withField({ creditValueIdr: 1, maxPayoutIdr: 2_000_000_000 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.maxPayoutIdr).toBeTruthy()
  })
})

describe('konfigurasi aktif', () => {
  it('menukar seluruh nilai sekaligus, tanpa keadaan campuran', () => {
    const next = withField({ creditValueIdr: 250, rewardHard3: 7 })
    setActiveEconomyConfig(next)
    expect(economyConfig().creditValueIdr).toBe(250)
    expect(economyConfig().rewardHard3).toBe(7)
    setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
    expect(economyConfig()).toEqual(DEFAULT_ECONOMY_CONFIG)
  })
})
