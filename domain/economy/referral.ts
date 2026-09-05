import { economyConfig } from '@/domain/economy/economy-config'

/** Laju komisi upline. Premium punya lajunya sendiri, dan yang menentukan adalah premium UPLINE — bukan downline yang mengerjakan soalnya: yang dibayar komisi upline, jadi manfaat berbayar itu miliknya. */
function referralCommissionRate(premium: boolean): number {
  return referralCommissionPercent(premium) / 100
}

export function referralCommissionPercent(premium = false): number {
  const config = economyConfig()
  return premium ? config.premiumReferralCommissionPercent : config.referralCommissionPercent
}

const COMMISSION_UNITS_PER_CREDIT = 100

export interface Referral {
  id: string
  name: string
  joinedAt: number
  tasksCompleted: number
  commissionUnits: number
  lastTaskAt: number | null
}

export interface ReferralSummary {
  credits: number
  pendingUnits: number
}

export function commissionUnitsForReward(reward: number, premium = false): number {
  return Math.round(reward * referralCommissionRate(premium) * COMMISSION_UNITS_PER_CREDIT)
}

export function unitsToCredits(units: number): number {
  return units / COMMISSION_UNITS_PER_CREDIT
}

export function splitUnitsIntoCredits(units: number): { credits: number; remainderUnits: number } {
  const credits = Math.floor(units / COMMISSION_UNITS_PER_CREDIT)
  return { credits, remainderUnits: units - credits * COMMISSION_UNITS_PER_CREDIT }
}
