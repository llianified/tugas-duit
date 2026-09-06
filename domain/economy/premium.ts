import { economyConfig } from './economy-config.ts'

/** Paket 6 dan 12 bulan menyusul di migrasi 0058. Yang membuatnya layak bukan diskonnya melainkan
 * ukuran tiketnya: satu pembayaran Rp139.900 menanggung ongkos gateway sekali, bukan dua belas
 * kali, dan user yang membayar setahun berhenti jadi orang yang tiap bulan menimbang ulang apakah
 * mau lanjut. Yang TIDAK berubah: premium tetap menjual kecepatan dan kenyamanan, bukan plafon
 * penghasilan — lihat catatan panjang di migrasi 0027. */
export type PremiumMonths = 1 | 2 | 3 | 6 | 12

export const PREMIUM_MONTHS: readonly PremiumMonths[] = [1, 2, 3, 6, 12]

export function isPremiumMonths(value: unknown): value is PremiumMonths {
  return PREMIUM_MONTHS.includes(value as PremiumMonths)
}

export function premiumPriceIdr(months: PremiumMonths): number {
  const config = economyConfig()
  if (months === 1) return config.premiumPrice1Idr
  if (months === 2) return config.premiumPrice2Idr
  if (months === 3) return config.premiumPrice3Idr
  if (months === 6) return config.premiumPrice6Idr
  return config.premiumPrice12Idr
}

export interface PremiumPlan {
  months: PremiumMonths
  priceIdr: number
  pricePerMonthIdr: number
  baselineIdr: number
  savingIdr: number
  savingPercent: number
  best: boolean
}

export function premiumPlan(months: PremiumMonths): PremiumPlan {
  const priceIdr = premiumPriceIdr(months)
  const baselineIdr = premiumPriceIdr(1) * months
  const savingIdr = Math.max(0, baselineIdr - priceIdr)
  return {
    months,
    priceIdr,
    pricePerMonthIdr: Math.round(priceIdr / months),
    baselineIdr,
    savingIdr,
    savingPercent: baselineIdr === 0 ? 0 : Math.round((savingIdr / baselineIdr) * 100),
    /** Yang paling hemat per bulan, dan itu selalu paket terpanjang selama tangga harganya lolos
     * `validateEconomyConfig`. Dulu dipatok `months === 3` — angka mati yang langsung berbohong
     * begitu paket 6 dan 12 bulan masuk. */
    best: months === PREMIUM_MONTHS[PREMIUM_MONTHS.length - 1],
  }
}

export function premiumPlans(): PremiumPlan[] {
  return PREMIUM_MONTHS.map(premiumPlan)
}

export function premiumWithdrawalCooldownMs(): number {
  return economyConfig().premiumWithdrawalCooldownDays * 86_400_000
}

/** Jeda antar penarikan. Keduanya sekarang setelan panel: yang biasa dulu konstanta `WITHDRAWAL_COOLDOWN_DAYS = 7`, sementara versi premium-nya sudah bisa disetel sejak migrasi 0027 — selisih yang membuat panel bisa memperpendek jeda premium sampai di bawah jeda biasa tanpa ada yang bisa menaikkan jeda biasanya. `validateEconomyConfig` sekarang menuntut jeda premium tidak pernah lebih panjang daripada jeda biasa. */
export function baseWithdrawalCooldownDays(): number {
  return economyConfig().withdrawalCooldownDays
}

export function withdrawalCooldownMs(premium: boolean): number {
  return premium ? premiumWithdrawalCooldownMs() : baseWithdrawalCooldownDays() * 86_400_000
}

export function isPremiumActive(premiumUntil: number | null, now: number): boolean {
  return premiumUntil !== null && premiumUntil > now
}

export function premiumDaysLeft(premiumUntil: number | null, now: number): number {
  if (!isPremiumActive(premiumUntil, now)) return 0
  return Math.ceil(((premiumUntil as number) - now) / 86_400_000)
}

export interface PremiumPerks {
  maxEnergy: number
  baseMaxEnergy: number
  energyRegenMinutes: number
  baseEnergyRegenMinutes: number
  poolCapBonus: number
  maxTasksPerDay: number
  baseMaxTasksPerDay: number
  withdrawalCooldownDays: number
  baseWithdrawalCooldownDays: number
  referralCommissionPercent: number
  baseReferralCommissionPercent: number
  dailyCommissionCapIdr: number
  baseDailyCommissionCapIdr: number
}

export function premiumPerks(): PremiumPerks {
  const config = economyConfig()
  return {
    maxEnergy: config.premiumMaxEnergy,
    baseMaxEnergy: config.maxEnergy,
    energyRegenMinutes: config.premiumEnergyRegenMinutes,
    baseEnergyRegenMinutes: config.energyRegenMinutes,
    poolCapBonus: config.premiumPoolCapBonus,
    maxTasksPerDay: config.premiumMaxTasksPerDay,
    baseMaxTasksPerDay: config.maxTasksPerDay,
    withdrawalCooldownDays: config.premiumWithdrawalCooldownDays,
    baseWithdrawalCooldownDays: config.withdrawalCooldownDays,
    referralCommissionPercent: config.premiumReferralCommissionPercent,
    baseReferralCommissionPercent: config.referralCommissionPercent,
    dailyCommissionCapIdr: config.premiumDailyCommissionCapIdr,
    baseDailyCommissionCapIdr: config.dailyCommissionCapIdr,
  }
}
