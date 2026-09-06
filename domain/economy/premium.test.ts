import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig, validateEconomyConfig } from './economy-config'
import { maxEnergy, energyRegenMs, projectEnergy } from './energy'
import { maxTasksPerDay } from './economy'
import {
  isPremiumActive,
  isPremiumMonths,
  premiumDaysLeft,
  premiumPerks,
  premiumPlan,
  premiumPlans,
  baseWithdrawalCooldownDays,
  withdrawalCooldownMs,
} from './premium'
import { rewardPoolCapacity } from './reward-pool'

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

const withConfig = (patch: Partial<typeof DEFAULT_ECONOMY_CONFIG>) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

describe('PREM-1 — tangga harga selalu makin murah per bulan', () => {
  it('menghitung hemat dan harga per bulan dari paket satu bulan', () => {
    const [satu, dua, tiga] = premiumPlans()

    expect(satu.priceIdr).toBe(19_900)
    expect(satu.savingIdr).toBe(0)
    expect(dua.baselineIdr).toBe(39_800)
    expect(dua.savingIdr).toBe(4_900)
    expect(dua.savingPercent).toBe(12)
    expect(tiga.savingIdr).toBe(14_800)
    expect(tiga.savingPercent).toBe(25)
  })

  /** `best` dulu dipatok `months === 3` — angka mati yang langsung berbohong begitu paket 6 dan 12
   * bulan masuk di migrasi 0058. Yang dilabeli "paling hemat" harus benar-benar yang paling murah
   * per bulan, kalau tidak lembar premium melabeli satu paket lalu memilihkan yang lain. */
  it('melabeli paket terpanjang sebagai yang paling hemat, bukan paket ketiga', () => {
    const plans = premiumPlans()
    const best = plans.filter((plan) => plan.best)

    expect(best).toHaveLength(1)
    expect(best[0].months).toBe(plans[plans.length - 1].months)
    expect(best[0].pricePerMonthIdr).toBe(Math.min(...plans.map((p) => p.pricePerMonthIdr)))
  })

  it('harga per bulan turun di setiap tingkat', () => {
    const plans = premiumPlans()
    for (let index = 1; index < plans.length; index += 1) {
      expect(plans[index].pricePerMonthIdr).toBeLessThan(plans[index - 1].pricePerMonthIdr)
    }
  })

  it('menolak konfigurasi yang membuat paket panjang tidak lebih hemat', () => {
    const flat = validateEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, premiumPrice2Idr: 39_800 })
    expect(flat.ok).toBe(false)
    if (!flat.ok) expect(flat.errors.premiumPrice2Idr).toBeTruthy()

    const mahal = validateEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, premiumPrice3Idr: 60_000 })
    expect(mahal.ok).toBe(false)
    if (!mahal.ok) expect(mahal.errors.premiumPrice3Idr).toBeTruthy()
  })

  it('mengikuti harga dari konfigurasi, bukan angka tetap', () => {
    withConfig({ premiumPrice1Idr: 30_000, premiumPrice2Idr: 50_000, premiumPrice3Idr: 60_000 })
    expect(premiumPlan(1).priceIdr).toBe(30_000)
    expect(premiumPlan(3).savingIdr).toBe(30_000)
  })
})

describe('PREM-2 — premium hanya mempercepat, tidak menaikkan plafon penghasilan', () => {
  it('menaikkan kapasitas energi, laju regen, kapasitas kolam, dan batas task', () => {
    expect(maxEnergy(true)).toBeGreaterThan(maxEnergy(false))
    expect(energyRegenMs(true)).toBeLessThan(energyRegenMs(false))
    expect(maxTasksPerDay(true)).toBeGreaterThan(maxTasksPerDay(false))
    expect(rewardPoolCapacity({ rankTier: 1, streak: 0, premium: true })).toBe(
      rewardPoolCapacity({ rankTier: 1, streak: 0 }) + DEFAULT_ECONOMY_CONFIG.premiumPoolCapBonus,
    )
  })

  it('tidak menyentuh laju isi ulang kolam, jadi penghasilan maksimum per hari tetap', () => {
    const perks = premiumPerks()
    expect(Object.keys(perks)).not.toContain('poolRegenMinutes')
    expect(DEFAULT_ECONOMY_CONFIG.rewardPoolRegenMinutes).toBe(48)
    expect(DEFAULT_ECONOMY_CONFIG.rewardPoolRegenCredits).toBe(1)
  })

  it('memproyeksikan energi premium dengan kapasitas dan interval premium', () => {
    const snapshot = { energy: 0, updatedAt: 0 }
    const afterFourHours = 4 * 60 * 60 * 1000

    expect(projectEnergy(snapshot, afterFourHours, false).current).toBe(4)
    expect(projectEnergy(snapshot, afterFourHours, true).current).toBe(9)
    expect(projectEnergy(snapshot, afterFourHours, true).max).toBe(10)
  })
})

describe('PREM-3 — jeda penarikan', () => {
  it('memakai jeda premium hanya untuk yang aktif', () => {
    expect(withdrawalCooldownMs(false)).toBe(baseWithdrawalCooldownDays() * 86_400_000)
    expect(withdrawalCooldownMs(true)).toBe(
      DEFAULT_ECONOMY_CONFIG.premiumWithdrawalCooldownDays * 86_400_000,
    )
    expect(withdrawalCooldownMs(true)).toBeLessThan(withdrawalCooldownMs(false))
  })
})

describe('PREM-4 — masa aktif', () => {
  const now = 1_700_000_000_000

  it('kedaluwarsa tepat saat lewat, bukan sebelumnya', () => {
    expect(isPremiumActive(now + 1, now)).toBe(true)
    expect(isPremiumActive(now, now)).toBe(false)
    expect(isPremiumActive(null, now)).toBe(false)
  })

  it('membulatkan sisa hari ke atas dan nol untuk yang sudah lewat', () => {
    expect(premiumDaysLeft(now + 86_400_000, now)).toBe(1)
    expect(premiumDaysLeft(now + 86_400_000 + 1, now)).toBe(2)
    expect(premiumDaysLeft(now - 1, now)).toBe(0)
    expect(premiumDaysLeft(null, now)).toBe(0)
  })

  it('menerima hanya 1, 2, dan 3 bulan', () => {
    expect(isPremiumMonths(1)).toBe(true)
    expect(isPremiumMonths(3)).toBe(true)
    expect(isPremiumMonths(4)).toBe(false)
    expect(isPremiumMonths('2')).toBe(false)
    expect(isPremiumMonths(null)).toBe(false)
  })
})
