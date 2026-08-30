import { economyConfig } from './economy-config.ts'

export function maxEnergy(premium = false): number {
  const config = economyConfig()
  return premium ? config.premiumMaxEnergy : config.maxEnergy
}

export function energyRegenMs(premium = false): number {
  const config = economyConfig()
  return (premium ? config.premiumEnergyRegenMinutes : config.energyRegenMinutes) * 60 * 1000
}

export function energyCostPerTask(): number {
  return economyConfig().energyCostPerTask
}

export interface EnergySnapshot {
  energy: number
  updatedAt: number
}

export interface EnergyState {
  current: number
  max: number
  nextAt: number | null
  fullAt: number | null
}

const clampStored = (energy: number, premium: boolean) =>
  Math.max(0, Math.min(maxEnergy(premium), Math.floor(Number.isFinite(energy) ? energy : 0)))

function regenGain(snapshot: EnergySnapshot, now: number, premium: boolean): number {
  const elapsed = Math.max(0, now - snapshot.updatedAt)
  return Math.floor(elapsed / energyRegenMs(premium))
}

function regenAnchor(snapshot: EnergySnapshot, now: number, premium: boolean): number {
  return snapshot.updatedAt + regenGain(snapshot, now, premium) * energyRegenMs(premium)
}

export function projectEnergy(
  snapshot: EnergySnapshot,
  now: number,
  premium = false,
): EnergyState {
  const max = maxEnergy(premium)
  const regen = energyRegenMs(premium)
  const current = Math.min(max, clampStored(snapshot.energy, premium) + regenGain(snapshot, now, premium))
  if (current >= max) return { current: max, max, nextAt: null, fullAt: null }

  const anchor = regenAnchor(snapshot, now, premium)
  return {
    current,
    max,
    nextAt: anchor + regen,
    fullAt: anchor + (max - current) * regen,
  }
}

interface EnergyChange {
  ok: boolean
  snapshot: EnergySnapshot
  state: EnergyState
}

export function applyEnergySpend(
  snapshot: EnergySnapshot,
  now: number,
  premium = false,
  cost: number = energyCostPerTask(),
): EnergyChange {
  const state = projectEnergy(snapshot, now, premium)
  if (state.current < cost) return { ok: false, snapshot, state }

  const next: EnergySnapshot = {
    energy: state.current - cost,
    updatedAt: state.current >= maxEnergy(premium) ? now : regenAnchor(snapshot, now, premium),
  }
  return { ok: true, snapshot: next, state: projectEnergy(next, now, premium) }
}

export function applyEnergyGrant(
  snapshot: EnergySnapshot,
  now: number,
  premium = false,
  amount: number = energyCostPerTask(),
): EnergyChange {
  const state = projectEnergy(snapshot, now, premium)
  const energy = Math.min(maxEnergy(premium), state.current + Math.max(0, Math.floor(amount)))
  const next: EnergySnapshot = {
    energy,
    updatedAt: energy >= maxEnergy(premium) ? now : regenAnchor(snapshot, now, premium),
  }
  return { ok: true, snapshot: next, state: projectEnergy(next, now, premium) }
}

export function secondsUntil(target: number | null, now: number): number | null {
  if (target === null) return null
  return Math.max(0, Math.ceil((target - now) / 1000))
}
