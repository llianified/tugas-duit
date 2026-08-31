'use client'

import type { AdProvider } from '@/domain/ads'
import { setActiveEconomyConfig, type EconomyConfig } from '@/domain/economy-config'
import type { EnergyState } from '@/domain/energy'
import type { PremiumMonths, PremiumPerks, PremiumPlan } from '@/domain/premium'
import type { RewardPoolState } from '@/domain/reward-pool'
import type { Challenge, HistoryEntry } from '@/features/captcha/domain'
import type { LeaderboardBoard } from '@/features/leaderboard/domain'
import type { UserStats } from '@/features/stats/domain'
import type { PublicPayout, Withdrawal, WithdrawalEligibility } from '@/features/withdraw/domain'
import { fetchJson, sendJson } from '@/shell/api-client'

export type SessionResponse = {
  economy?: EconomyConfig
  user: {
    id: string
    firstName: string
    username: string | null
    photoUrl: string | null
    balance: number
    referralCode: string
    banned?: boolean
  } | null
  breakdown?: { taskCredits: number; referralCredits: number; withdrawnCredits: number }
  energy?: EnergyState & {
    now: number
    receivedAt: number
  }
  rewardPool?: RewardPoolState & {
    now: number
    receivedAt: number
  }
  ads?: AdsState
  premium?: PremiumState
  channelBonus?: ChannelBonusState
  botAppUrl?: string | null
}

export type PremiumInvoice = {
  orderId: string
  months: PremiumMonths
  amountIdr: number
  totalAmountIdr: number
  qrisUrl: string | null
  expiresAt: number
}

export type PremiumState = {
  active: boolean
  until: number | null
  daysLeft: number
  paymentEnabled: boolean
  plans: PremiumPlan[]
  perks: PremiumPerks
  invoice: PremiumInvoice | null
}

export type ChannelBonusState = {
  enabled: boolean
  url: string
  credits: number
  claimed: boolean
}

export type PremiumCheckoutResponse =
  | { settled: true; premiumUntil: number }
  | { settled: false; invoice: PremiumInvoice }

export type ChannelClaimResponse = { credits: number; balance: number }

export async function startPremiumCheckout(months: PremiumMonths) {
  return sendJson<PremiumCheckoutResponse>('/api/premium/checkout', 'POST', { months })
}

export async function claimChannelBonus() {
  return sendJson<ChannelClaimResponse>('/api/channel/claim', 'POST')
}

export async function fetchPublicPayouts() {
  return fetchJson<{ payouts: PublicPayout[] }>('/api/public-payouts')
}

export type TaskPayment = 'energy' | 'ad'

export type AdsState = {
  /** Tiket berhadiah (opt-in). Tetap `true` untuk premium. */
  enabled: boolean
  /** Interstitial otomatis. `false` untuk premium. */
  inAppEnabled: boolean
  provider: AdProvider | null
  unitId: string | null
  viewsLeft: number
  cooldownSecondsLeft: number
  pass: { expiresAt: number } | null
}

export type AdTicketResponse = {
  ticketId: string
  provider: AdProvider
  unitId: string
  expiresAt: number
}

export type AdClaimResponse = { pass: { expiresAt: number } }

export type SessionEnergy = NonNullable<SessionResponse['energy']>
export type SessionRewardPool = NonNullable<SessionResponse['rewardPool']>

export type TaskResponse = { challenge: Challenge }
export type HistoryResponse = { entries: HistoryEntry[]; nextCursor: string | null }
export type StatsResponse = { stats: UserStats }
export type LeaderboardResponse = { board: LeaderboardBoard }
export type ReferralResponse = {
  code: string
  shareUrl: string
  pendingUnits: number
  downlines: Array<{
    id: string
    displayName: string
    joinedAt: number
    taskCount: number
    commissionUnits: number
    lastActiveAt: number | null
  }>
}
export type WithdrawalsResponse = {
  withdrawals: Withdrawal[]
  totals: { withdrawnCredits: number; processingCredits: number }
  eligibility: WithdrawalEligibility
}
export type SubmitResponse =
  | { ok: true; stars: 1 | 2 | 3; reward: number; balance: number; elapsedMs: number }
  | { ok: false; reason: string; attemptsLeft?: number }

export type StartTaskResponse = {
  challenge: Challenge
  elapsedMs: number
  energy: EnergyState & { now: number }
  paidBy: TaskPayment
}

async function fetchSession(): Promise<SessionResponse> {
  const session = await fetchJson<SessionResponse>('/api/session')
  if (session.economy) setActiveEconomyConfig(session.economy)

  const receivedAt = Date.now()
  return {
    ...session,
    energy: session.energy ? { ...session.energy, receivedAt } : undefined,
    rewardPool: session.rewardPool ? { ...session.rewardPool, receivedAt } : undefined,
  }
}

export async function loadSession(): Promise<SessionResponse> {
  let session = await fetchSession()
  if (session.user || typeof window === 'undefined') return session

  const telegram = (window as Window & {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } }
  }).Telegram?.WebApp
  const initData = telegram?.initData
  if (!initData) {
    if (process.env.NODE_ENV === 'production') return session
    await sendJson('/api/dev/login', 'POST')
    return fetchSession()
  }

  telegram?.ready?.()
  telegram?.expand?.()
  await sendJson('/api/auth/telegram', 'POST', { initData })
  session = await fetchSession()
  return session
}
