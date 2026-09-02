import { economyConfig } from '@/domain/economy/economy-config'

function referralCommissionRate(): number {
  return economyConfig().referralCommissionPercent / 100
}

export function referralCommissionPercent(): number {
  return economyConfig().referralCommissionPercent
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

export function commissionUnitsForReward(reward: number): number {
  return Math.round(reward * referralCommissionRate() * COMMISSION_UNITS_PER_CREDIT)
}

export function unitsToCredits(units: number): number {
  return units / COMMISSION_UNITS_PER_CREDIT
}

export function splitUnitsIntoCredits(units: number): { credits: number; remainderUnits: number } {
  const credits = Math.floor(units / COMMISSION_UNITS_PER_CREDIT)
  return { credits, remainderUnits: units - credits * COMMISSION_UNITS_PER_CREDIT }
}
