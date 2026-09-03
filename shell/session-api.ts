'use client'

import type { AdProvider } from '@/domain/ads/ads'
import { setActiveEconomyConfig, type EconomyConfig } from '@/domain/economy/economy-config'
import type { EnergyState } from '@/domain/economy/energy'
import type { PremiumMonths, PremiumPerks, PremiumPlan } from '@/domain/economy/premium'
import type { RewardPoolState } from '@/domain/economy/reward-pool'
import type { Challenge, HistoryEntry } from '@/domain/task/challenge'
import type { ActivityEntry } from '@/domain/progression/activity'
import type { LeaderboardBoard } from '@/domain/progression/leaderboard'
import type { UserStats } from '@/domain/progression/stats'
import type { Withdrawal, WithdrawalEligibility } from '@/domain/economy/withdrawal'
import { fetchJson, sendJson, setPreviewSessionToken } from '@/shell/api-client'

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
    founder?: boolean
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
  channelGate?: ChannelGateState
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

export type ChannelGateState = {
  required: boolean
  member: boolean
  url: string
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

export async function verifyChannelMembership() {
  return sendJson<ChannelGateState>('/api/channel/verify', 'POST')
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
  /** Potret dari server. Untuk hitungan mundur yang berjalan pakai `cooldownUntil`. */
  cooldownSecondsLeft: number
  cooldownUntil: number | null
  now: number
  receivedAt: number
  pass: { expiresAt: number } | null
  /** Task berbayar tiket yang belum ditutup. Server menolak tiket baru selama ini menyala. */
  entryOpen: boolean
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
export type ActivityResponse = { entries: ActivityEntry[] }
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
    ads: session.ads ? { ...session.ads, receivedAt } : undefined,
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
    /** Token yang dikembalikan dipasang sebagai pembawa sesi cadangan. Cookie tetap jalur utamanya; ini hanya menolong saat browser membuang cookie pihak ketiga di dalam iframe preview. Route ini 404 di luar preview, jadi `token` null di sana dan pemasangannya jadi no-op. */
    const dev = await sendJson<{ token: string | null }>('/api/dev/login', 'POST')
    setPreviewSessionToken(dev?.token ?? null)
    return fetchSession()
  }

  telegram?.ready?.()
  telegram?.expand?.()
  await sendJson('/api/auth/telegram', 'POST', { initData })
  session = await fetchSession()
  return session
}
