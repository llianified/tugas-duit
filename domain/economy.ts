
import { economyConfig } from './economy-config'
import { rewardPoolCreditsPerDay } from './reward-pool'

export function withdrawalMinimumCredits(): number {
  const config = economyConfig()
  return config.withdrawalMinimumIdr / config.creditValueIdr
}

export function maxPayoutCredits(): number {
  const config = economyConfig()
  return config.maxPayoutIdr / config.creditValueIdr
}

export function maxTasksPerDay(): number {
  return economyConfig().maxTasksPerDay
}

export function dailyCommissionCreditCap(): number {
  const config = economyConfig()
  return config.dailyCommissionCapIdr / config.creditValueIdr
}

/**
 * Estimasi, bukan janji: dihitung dari laju isi ulang kolam reward selama 24 jam, dengan asumsi
 * user menghabiskan setiap credit yang masuk.
 */
export function firstWithdrawalEstimateDays(): number {
  return Math.max(1, Math.ceil(withdrawalMinimumCredits() / rewardPoolCreditsPerDay()))
}

export function creditsToRupiah(credits: number): number {
  return credits * economyConfig().creditValueIdr
}

interface WithdrawalStatus {
  eligible: boolean
  remainingCredits: number
  remainingRupiah: number
}

export function getWithdrawalStatus(balance: number): WithdrawalStatus {
  const minimum = withdrawalMinimumCredits()
  const remainingCredits = Math.max(0, minimum - balance)

  return {
    eligible: balance >= minimum,
    remainingCredits,
    remainingRupiah: creditsToRupiah(remainingCredits),
  }
}
