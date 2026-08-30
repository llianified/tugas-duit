import { economyConfig } from './economy-config.ts'

export const WITHDRAWAL_COOLDOWN_DAYS = 7

export type PremiumMonths = 1 | 2 | 3

export const PREMIUM_MONTHS: readonly PremiumMonths[] = [1, 2, 3]

export function isPremiumMonths(value: unknown): value is PremiumMonths {
  return value === 1 || value === 2 || value === 3
}

export function premiumPriceIdr(months: PremiumMonths): number {
  const config = economyConfig()
  if (months === 1) return config.premiumPrice1Idr
  if (months === 2) return config.premiumPrice2Idr
  return config.premiumPrice3Idr
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
    best: months === 3,
  }
}

export function premiumPlans(): PremiumPlan[] {
  return PREMIUM_MONTHS.map(premiumPlan)
}

export function premiumWithdrawalCooldownMs(): number {
  return economyConfig().premiumWithdrawalCooldownDays * 86_400_000
}

export function withdrawalCooldownMs(premium: boolean): number {
  return premium ? premiumWithdrawalCooldownMs() : WITHDRAWAL_COOLDOWN_DAYS * 86_400_000
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
    baseWithdrawalCooldownDays: WITHDRAWAL_COOLDOWN_DAYS,
  }
}
