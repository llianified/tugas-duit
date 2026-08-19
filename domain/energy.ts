import { economyConfig } from './economy-config'

export function maxEnergy(): number {
  return economyConfig().maxEnergy
}

export function energyRegenMs(): number {
  return economyConfig().energyRegenMinutes * 60 * 1000
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

const clampStored = (energy: number) =>
  Math.max(0, Math.min(maxEnergy(), Math.floor(Number.isFinite(energy) ? energy : 0)))

function regenGain(snapshot: EnergySnapshot, now: number): number {
  const elapsed = Math.max(0, now - snapshot.updatedAt)
  return Math.floor(elapsed / energyRegenMs())
}

function regenAnchor(snapshot: EnergySnapshot, now: number): number {
  return snapshot.updatedAt + regenGain(snapshot, now) * energyRegenMs()
}

export function projectEnergy(snapshot: EnergySnapshot, now: number): EnergyState {
  const current = Math.min(maxEnergy(), clampStored(snapshot.energy) + regenGain(snapshot, now))
  if (current >= maxEnergy()) return { current: maxEnergy(), max: maxEnergy(), nextAt: null, fullAt: null }

  const anchor = regenAnchor(snapshot, now)
  return {
    current,
    max: maxEnergy(),
    nextAt: anchor + energyRegenMs(),
    fullAt: anchor + (maxEnergy() - current) * energyRegenMs(),
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
  cost: number = energyCostPerTask(),
): EnergyChange {
  const state = projectEnergy(snapshot, now)
  if (state.current < cost) return { ok: false, snapshot, state }

  const next: EnergySnapshot = {
    energy: state.current - cost,
    updatedAt: state.current >= maxEnergy() ? now : regenAnchor(snapshot, now),
  }
  return { ok: true, snapshot: next, state: projectEnergy(next, now) }
}

export function applyEnergyGrant(
  snapshot: EnergySnapshot,
  now: number,
  amount: number = energyCostPerTask(),
): EnergyChange {
  const state = projectEnergy(snapshot, now)
  const energy = Math.min(maxEnergy(), state.current + Math.max(0, Math.floor(amount)))
  const next: EnergySnapshot = {
    energy,
    updatedAt: energy >= maxEnergy() ? now : regenAnchor(snapshot, now),
  }
  return { ok: true, snapshot: next, state: projectEnergy(next, now) }
}

export function secondsUntil(target: number | null, now: number): number | null {
  if (target === null) return null
  return Math.max(0, Math.ceil((target - now) / 1000))
}
