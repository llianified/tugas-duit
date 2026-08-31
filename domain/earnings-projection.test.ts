import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMY_CONFIG,
  setActiveEconomyConfig,
  type EconomyConfig,
} from './economy-config'
import { creditsToRupiah, firstWithdrawalEstimateDays, withdrawalMinimumCredits } from './economy'
import { baseRewardPoolCredits, rewardPoolCapacity, rewardPoolCreditsPerDay } from './reward-pool'
import { projectEarnings } from './earnings-projection'

const withConfig = <T>(config: EconomyConfig, run: () => T): T => {
  setActiveEconomyConfig(config)
  return run()
}

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

/**
 * Proyeksi menghitung dari config yang dioper, sementara sisa `domain/` menghitung dari
 * config aktif. Uji ini yang menahan keduanya tidak berpisah jalan: kalau salah satu
 * rumusnya diubah tanpa yang lain, angkanya berhenti cocok di sini.
 */
const VARIANTS: [string, EconomyConfig][] = [
  ['bawaan', DEFAULT_ECONOMY_CONFIG],
  [
    'kurs dinaikkan',
    { ...DEFAULT_ECONOMY_CONFIG, creditValueIdr: 250, rewardPoolCapIdr: 7_500 },
  ],
  [
    'isi ulang dipercepat',
    { ...DEFAULT_ECONOMY_CONFIG, rewardPoolRegenMinutes: 12, rewardPoolRegenCredits: 2 },
  ],
  [
    'energi dan iklan dipangkas',
    {
      ...DEFAULT_ECONOMY_CONFIG,
      rewardPoolRegenMinutes: 5,
      maxEnergy: 1,
      energyRegenMinutes: 240,
      adsMaxViewsPerDay: 0,
    },
  ],
]

describe('projectEarnings sejalan dengan domain config-aktif', () => {
  it.each(VARIANTS)('%s: laju kolam sama dengan rewardPoolCreditsPerDay', (_label, config) => {
    const live = withConfig(config, () => rewardPoolCreditsPerDay())
    const projected = projectEarnings(config)
    expect(Math.min(live, projected.taskCeilingCredits)).toBe(projected.taskCreditsPerDay)
  })

  it.each(VARIANTS)('%s: kapasitas dasar sama dengan baseRewardPoolCredits', (_label, config) => {
    expect(projectEarnings(config).poolCapacityBase).toBe(
      withConfig(config, () => baseRewardPoolCredits()),
    )
  })

  it.each(VARIANTS)('%s: kapasitas maksimum sama dengan rewardPoolCapacity', (_label, config) => {
    const live = withConfig(config, () =>
      rewardPoolCapacity({ rankTier: 5, streak: config.streakCapStepDays * 99, premium: true }),
    )
    expect(projectEarnings(config).poolCapacityMax).toBe(live)
  })

  it.each(VARIANTS)('%s: minimum penarikan sama dengan withdrawalMinimumCredits', (_label, config) => {
    expect(projectEarnings(config).withdrawalMinimumCredits).toBe(
      withConfig(config, () => withdrawalMinimumCredits()),
    )
  })

  it.each(VARIANTS)('%s: rupiah harian sama dengan creditsToRupiah', (_label, config) => {
    const projection = projectEarnings(config)
    expect(projection.taskRupiahPerDay).toBe(
      withConfig(config, () => creditsToRupiah(projection.taskCreditsPerDay)),
    )
  })
})

describe('projectEarnings menandai pengikat yang benar', () => {
  it('setelan bawaan diikat kolam reward, bukan batas task', () => {
    const projection = projectEarnings(DEFAULT_ECONOMY_CONFIG)
    expect(projection.binding).toBe('kolam')
    expect(projection.taskCeilingCredits).toBeGreaterThan(projection.taskCreditsPerDay)
  })

  it('kolam yang sangat cepat memindahkan pengikat ke energi', () => {
    const projection = projectEarnings({
      ...DEFAULT_ECONOMY_CONFIG,
      rewardPoolRegenMinutes: 1,
      rewardPoolRegenCredits: 50,
      adsMaxViewsPerDay: 0,
      maxEnergy: 1,
      energyRegenMinutes: 720,
    })
    expect(projection.binding).toBe('energi')
  })

  it('batas task rendah memindahkan pengikat ke batas task', () => {
    const projection = projectEarnings({
      ...DEFAULT_ECONOMY_CONFIG,
      rewardPoolRegenMinutes: 1,
      rewardPoolRegenCredits: 50,
      maxTasksPerDay: 2,
    })
    expect(projection.binding).toBe('batas-task')
  })
})

describe('projectEarnings tahan nilai config yang belum sah', () => {
  it.each([0, -5, Number.NaN])('regen %s tidak menghasilkan angka tak hingga', (value) => {
    const projection = projectEarnings({
      ...DEFAULT_ECONOMY_CONFIG,
      rewardPoolRegenMinutes: value,
      rewardPoolRegenCredits: value,
    })
    expect(Number.isFinite(projection.totalRupiahPerDay)).toBe(true)
    expect(Number.isFinite(projection.daysToWithdrawalBalance)).toBe(true)
  })

  it('kurs nol tidak membagi dengan nol', () => {
    const projection = projectEarnings({ ...DEFAULT_ECONOMY_CONFIG, creditValueIdr: 0 })
    expect(Number.isFinite(projection.poolCapacityBase)).toBe(true)
    expect(Number.isFinite(projection.withdrawalMinimumCredits)).toBe(true)
  })
})

describe('estimasi hari penarikan sejalan dengan salinan yang dilihat user', () => {
  it('tanpa komisi, sama dengan firstWithdrawalEstimateDays', () => {
    const config: EconomyConfig = { ...DEFAULT_ECONOMY_CONFIG, dailyCommissionCapIdr: 0 }
    expect(projectEarnings(config).daysToWithdrawalBalance).toBe(
      withConfig(config, () => firstWithdrawalEstimateDays()),
    )
  })
})
