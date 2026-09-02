import { describe, expect, it } from 'vitest'
import {
  applyEnergyGrant,
  applyEnergySpend,
  energyRegenMs,
  maxEnergy,
  projectEnergy,
  secondsUntil,
} from './energy'

const T0 = 1_700_000_000_000

describe('energy regen', () => {
  it('gives one energy per full interval and none before it', () => {
    const snapshot = { energy: 0, updatedAt: T0 }
    expect(projectEnergy(snapshot, T0 + energyRegenMs() - 1).current).toBe(0)
    expect(projectEnergy(snapshot, T0 + energyRegenMs()).current).toBe(1)
    expect(projectEnergy(snapshot, T0 + 3 * energyRegenMs()).current).toBe(3)
  })

  it('never projects above capacity', () => {
    expect(projectEnergy({ energy: 0, updatedAt: T0 }, T0 + 99 * energyRegenMs())).toEqual({
      current: maxEnergy(),
      max: maxEnergy(),
      nextAt: null,
      fullAt: null,
    })
  })

  it('does not burn leftover minutes across repeated reads', () => {
    const snapshot = { energy: 0, updatedAt: T0 }
    const almost = energyRegenMs() - 60_000
    expect(projectEnergy(snapshot, T0 + almost).current).toBe(0)
    expect(projectEnergy(snapshot, T0 + almost + 60_000).current).toBe(1)
  })

  it('announces the next and full timestamps from the advanced anchor', () => {
    const state = projectEnergy(
      { energy: 1, updatedAt: T0 },
      T0 + energyRegenMs() + energyRegenMs() / 2,
    )
    expect(state.current).toBe(2)
    expect(state.nextAt).toBe(T0 + 2 * energyRegenMs())
    expect(state.fullAt).toBe(T0 + 4 * energyRegenMs())
  })

  it('ignores clocks that run backwards', () => {
    expect(projectEnergy({ energy: 2, updatedAt: T0 }, T0 - 10 * energyRegenMs()).current).toBe(2)
  })
})

describe('energy spend', () => {
  it('starts the regen clock when spending from full', () => {
    const idle = { energy: maxEnergy(), updatedAt: T0 }
    const now = T0 + 50 * energyRegenMs()
    const spent = applyEnergySpend(idle, now)
    expect(spent.ok).toBe(true)
    expect(spent.snapshot).toEqual({ energy: maxEnergy() - 1, updatedAt: now })
    expect(spent.state.current).toBe(maxEnergy() - 1)
    expect(spent.state.nextAt).toBe(now + energyRegenMs())
  })

  it('keeps the pending minutes when spending below full', () => {
    const snapshot = { energy: 1, updatedAt: T0 }
    const now = T0 + energyRegenMs() / 2
    const spent = applyEnergySpend(snapshot, now)
    expect(spent.snapshot).toEqual({ energy: 0, updatedAt: T0 })
    expect(spent.state.nextAt).toBe(T0 + energyRegenMs())
  })

  it('refuses and leaves the snapshot untouched when empty', () => {
    const snapshot = { energy: 0, updatedAt: T0 }
    const now = T0 + energyRegenMs() / 2
    const spent = applyEnergySpend(snapshot, now)
    expect(spent.ok).toBe(false)
    expect(spent.snapshot).toBe(snapshot)
    expect(spent.state.nextAt).toBe(T0 + energyRegenMs())
  })
})

describe('energy grant', () => {
  it('refunds one energy without exceeding capacity', () => {
    expect(applyEnergyGrant({ energy: 1, updatedAt: T0 }, T0).snapshot.energy).toBe(2)
    expect(applyEnergyGrant({ energy: maxEnergy(), updatedAt: T0 }, T0).snapshot.energy).toBe(
      maxEnergy(),
    )
  })

  it('stops the regen clock once the refund fills the pool', () => {
    const now = T0 + energyRegenMs() / 2
    const granted = applyEnergyGrant({ energy: maxEnergy() - 1, updatedAt: T0 }, now)
    expect(granted.snapshot).toEqual({ energy: maxEnergy(), updatedAt: now })
    expect(granted.state.nextAt).toBeNull()
  })
})

describe('countdown', () => {
  it('rounds up so the counter never reaches zero before the energy exists', () => {
    expect(secondsUntil(T0 + 1_001, T0)).toBe(2)
    expect(secondsUntil(T0 - 5_000, T0)).toBe(0)
    expect(secondsUntil(null, T0)).toBeNull()
  })
})
