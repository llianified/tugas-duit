import { economyConfig } from './economy-config'

/**
 * Kolam reward: plafon penghasilan yang mengisi ulang bertahap, bukan reset tengah malam.
 *
 * Bentuknya sengaja dibuat sama dengan `domain/energy.ts` — stok tersimpan plus jam acuan
 * regen — karena keduanya menjawab pertanyaan yang sama: berapa yang tersedia sekarang, dan
 * kapan tambahan berikutnya datang. Bedanya cuma satuannya (credit, bukan energi) dan
 * kapasitasnya yang ikut rank serta streak, jadi kapasitas selalu dikirim dari luar.
 */

export function baseRewardPoolCredits(): number {
  const config = economyConfig()
  return config.rewardPoolCapIdr / config.creditValueIdr
}

export function rewardPoolRegenMs(): number {
  return economyConfig().rewardPoolRegenMinutes * 60 * 1000
}

export function rewardPoolRegenCredits(): number {
  return economyConfig().rewardPoolRegenCredits
}

/** Credit yang masuk ke kolam dalam 24 jam penuh, dipakai untuk estimasi, bukan untuk penjagaan. */
export function rewardPoolCreditsPerDay(): number {
  return (1_440 / economyConfig().rewardPoolRegenMinutes) * rewardPoolRegenCredits()
}

interface CapacityInput {
  rankTier: number
  streak: number
}

/** Rank dan streak menambah daya tampung kolam, bukan kecepatan isi ulangnya. */
export function rewardPoolCapacity({ rankTier, streak }: CapacityInput): number {
  const config = economyConfig()
  const normalizedTier = Math.min(5, Math.max(1, Math.floor(rankTier)))
  const rankBonus = (normalizedTier - 1) * config.rankPoolCapBonus
  const streakBonus = Math.min(
    config.maxStreakCapBonus,
    Math.floor(Math.max(0, streak) / config.streakCapStepDays),
  )
  return baseRewardPoolCredits() + rankBonus + streakBonus
}

export interface RewardPoolSnapshot {
  credits: number
  updatedAt: number
}

export interface RewardPoolState {
  current: number
  max: number
  regenCredits: number
  nextAt: number | null
  fullAt: number | null
}

const clampStored = (credits: number, capacity: number) =>
  Math.max(0, Math.min(capacity, Math.floor(Number.isFinite(credits) ? credits : 0)))

function regenSteps(snapshot: RewardPoolSnapshot, now: number): number {
  return Math.floor(Math.max(0, now - snapshot.updatedAt) / rewardPoolRegenMs())
}

/**
 * Jam acuan hanya dimajukan sebanyak interval yang benar-benar dibayar, sehingga menit sisa
 * tidak hangus untuk user yang membuka app tepat sebelum interval berikutnya genap.
 */
function regenAnchor(snapshot: RewardPoolSnapshot, now: number): number {
  return snapshot.updatedAt + regenSteps(snapshot, now) * rewardPoolRegenMs()
}

export function projectRewardPool(
  snapshot: RewardPoolSnapshot,
  capacity: number,
  now: number,
): RewardPoolState {
  const regen = rewardPoolRegenCredits()
  const current = Math.min(
    capacity,
    clampStored(snapshot.credits, capacity) + regenSteps(snapshot, now) * regen,
  )
  if (current >= capacity) {
    return { current: capacity, max: capacity, regenCredits: regen, nextAt: null, fullAt: null }
  }

  const anchor = regenAnchor(snapshot, now)
  const stepsToFull = Math.ceil((capacity - current) / regen)
  return {
    current,
    max: capacity,
    regenCredits: regen,
    nextAt: anchor + rewardPoolRegenMs(),
    fullAt: anchor + stepsToFull * rewardPoolRegenMs(),
  }
}

interface RewardPoolSpend {
  /** Yang benar-benar dibayar: sebanyak yang tersisa di kolam, tidak pernah lebih. */
  paid: number
  snapshot: RewardPoolSnapshot
  state: RewardPoolState
}

export function applyRewardPoolSpend(
  snapshot: RewardPoolSnapshot,
  capacity: number,
  now: number,
  amount: number,
): RewardPoolSpend {
  const state = projectRewardPool(snapshot, capacity, now)
  const paid = Math.max(0, Math.min(state.current, Math.floor(amount)))
  if (paid === 0) return { paid: 0, snapshot, state }

  const next: RewardPoolSnapshot = {
    credits: state.current - paid,
    // Kolam yang tadinya penuh belum punya jam acuan yang berjalan; hitungan mulai dari sekarang.
    updatedAt: state.current >= capacity ? now : regenAnchor(snapshot, now),
  }
  return { paid, snapshot: next, state: projectRewardPool(next, capacity, now) }
}

export function applyRewardPoolRefund(
  snapshot: RewardPoolSnapshot,
  capacity: number,
  now: number,
  amount: number,
): RewardPoolSpend {
  const state = projectRewardPool(snapshot, capacity, now)
  const credits = Math.min(capacity, state.current + Math.max(0, Math.floor(amount)))
  const next: RewardPoolSnapshot = {
    credits,
    updatedAt: credits >= capacity ? now : regenAnchor(snapshot, now),
  }
  return { paid: 0, snapshot: next, state: projectRewardPool(next, capacity, now) }
}
