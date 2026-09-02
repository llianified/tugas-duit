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
  // Sama dengan DEFAULT_IN_APP_ADS_SETTINGS yang lama, jadi pemindahan jadwal | interstitial ke config tidak mengubah perilaku bawaan.
  inAppAdsFrequency: 2, inAppAdsCappingMinutes: 6,
  inAppAdsIntervalSeconds: 30, inAppAdsTimeoutSeconds: 5,
  withdrawalMinimumIdr: 10_000, withdrawalMinActiveReferrals: 5,
  // Dulu konstanta kode: REQUIRED_ACTIVE_DAYS di payout-rules.ts dan | WITHDRAWAL_COOLDOWN_DAYS di domain/premium.ts. Angkanya sama persis, jadi | memindahkannya ke panel tidak menggeser satu pun gerbang yang berjalan.
  withdrawalMinActiveDays: 7, withdrawalCooldownDays: 7,
  // Dulu LEADERBOARD_ENABLED = true di features/leaderboard/availability.ts.
  leaderboardEnabled: 1,
  // Dulu MISSIONS di domain/missions.ts.
  missionTasksTarget: 5, missionTasksReward: 2,
  missionStarsTarget: 3, missionStarsReward: 2,
  missionAdsTarget: 3, missionAdsReward: 3,
  maxPayoutIdr: 2_000_000_000, referralCommissionPercent: 10, dailyCommissionCapIdr: 6_000,
  rankTier2Tasks: 100, rankTier3Tasks: 300, rankTier4Tasks: 700, rankTier5Tasks: 1_500,
  channelJoinBonusCredits: 25, channelGateEnabled: 1,
  premiumPrice1Idr: 19_900, premiumPrice2Idr: 34_900, premiumPrice3Idr: 44_900,
  premiumMaxEnergy: 10, premiumEnergyRegenMinutes: 25, premiumPoolCapBonus: 15,
  premiumMaxTasksPerDay: 1_000, premiumWithdrawalCooldownDays: 3,
}

const withField = (patch: Partial<EconomyConfig>) => ({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

const CONFIG_WITHOUT_NEW_KEY = (() => {
  const config: Record<string, number> = { ...DEFAULT_ECONOMY_CONFIG }
  delete config.withdrawalMinActiveReferrals
  return config
})()

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
  // 0% menghentikan penulisan referral_commissions, sedangkan syarat penarikan menghitung | downline dari baris itu — jadi 0% mengunci penarikan tanpa pesan yang menjelaskan.
  it('komisi nol mengunci syarat penarikan', () =>
    rejects({ referralCommissionPercent: 0 }, 'referralCommissionPercent'))
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

describe('invarian setelan panel yang baru dipindah dari kode', () => {
  /** Hadiah misi yang tidak muat di kapasitas energi membuat misinya tidak pernah bisa diklaim siapa pun: `claimMission` menolak klaim yang hadiahnya terpotong. Gagalnya diam — yang terlihat cuma tombol klaim yang selalu menolak — jadi ditangkap di validasi. */
  it('menolak hadiah misi yang melewati kapasitas energi', () => {
    const result = validateEconomyConfig(withField({ maxEnergy: 5, missionAdsReward: 6 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors)).toContain('missionAdsReward')
  })

  it('menerima hadiah misi yang pas di kapasitas', () => {
    expect(validateEconomyConfig(withField({ maxEnergy: 5, missionAdsReward: 5 })).ok).toBe(true)
  })

  /** Jeda premium yang lebih panjang daripada jeda biasa membuat premium jadi kerugian: pembeli menunggu lebih lama daripada yang tidak membayar. Sebelum `withdrawalCooldownDays` bisa disetel, ini mustahil karena jeda biasa terpaku 7 di kode. */
  it('menolak jeda penarikan premium yang lebih panjang daripada jeda biasa', () => {
    const result = validateEconomyConfig(
      withField({ withdrawalCooldownDays: 3, premiumWithdrawalCooldownDays: 7 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors)).toContain('premiumWithdrawalCooldownDays')
  })

  it('menerima jeda premium yang sama panjang dengan jeda biasa', () => {
    expect(
      validateEconomyConfig(
        withField({ withdrawalCooldownDays: 5, premiumWithdrawalCooldownDays: 5 }),
      ).ok,
    ).toBe(true)
  })

  it('papan peringkat hanya menerima 0 atau 1', () => {
    expect(validateEconomyConfig(withField({ leaderboardEnabled: 2 })).ok).toBe(false)
    expect(validateEconomyConfig(withField({ leaderboardEnabled: -1 })).ok).toBe(false)
    expect(validateEconomyConfig(withField({ leaderboardEnabled: 0 })).ok).toBe(true)
  })

  it('hari aktif minimum tidak boleh nol — itu mencabut gerbang waktunya sama sekali', () => {
    expect(validateEconomyConfig(withField({ withdrawalMinActiveDays: 0 })).ok).toBe(false)
  })
})

describe('kompatibilitas konfigurasi tersimpan', () => {
  it('menolak baris yang kekurangan key saat dibaca ketat', () => {
    const result = validateEconomyConfig(CONFIG_WITHOUT_NEW_KEY)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.withdrawalMinActiveReferrals).toBeTruthy()
  })

  it('mengisi key baru dari nilai bawaan ketika membaca database lama', () => {
    const result = validateEconomyConfig(CONFIG_WITHOUT_NEW_KEY, { fillMissing: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.withdrawalMinActiveReferrals).toBe(
      DEFAULT_ECONOMY_CONFIG.withdrawalMinActiveReferrals,
    )
    expect(result.config.creditValueIdr).toBe(DEFAULT_ECONOMY_CONFIG.creditValueIdr)
  })

  it('tetap menolak nilai yang ada tetapi rusak', () => {
    const broken = { ...DEFAULT_ECONOMY_CONFIG, maxEnergy: -3 } as unknown as EconomyConfig

    expect(validateEconomyConfig(broken, { fillMissing: true }).ok).toBe(false)
  })

  it('mempertahankan semua nilai admin saat mengisi key yang hilang', () => {
    const configured = {
      ...CONFIG_WITHOUT_NEW_KEY,
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
    const result = validateEconomyConfig(configured, { fillMissing: true })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.energyRegenMinutes).toBe(10)
    expect(result.config.rewardPoolRegenMinutes).toBe(6)
    expect(result.config.withdrawalMinActiveReferrals).toBe(
      DEFAULT_ECONOMY_CONFIG.withdrawalMinActiveReferrals,
    )
  })
})
