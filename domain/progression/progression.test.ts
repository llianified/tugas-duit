import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '../economy/economy-config'
import { getProgression, getRank } from './progression'

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

describe('progression', () => {
  it('memilih rank tertinggi yang ambangnya sudah dicapai', () => {
    expect(getRank(0).tier).toBe(1)
    expect(getRank(DEFAULT_ECONOMY_CONFIG.rankTier3Tasks).tier).toBe(3)
    expect(getRank(Number.MAX_SAFE_INTEGER).tier).toBe(5)
  })

  it('menghitung jarak dan progres menuju rank berikutnya', () => {
    const progression = getProgression({ completedCount: 25, streak: 4, todayCount: 1 })

    expect(progression.rank.tier).toBe(1)
    expect(progression.rankProgress).toBe(25)
    expect(progression.tasksToNextRank).toBe(
      DEFAULT_ECONOMY_CONFIG.rankTier2Tasks - 25,
    )
    expect(progression.streakSecured).toBe(true)
  })

  it('berhenti pada rank terakhir tanpa target semu', () => {
    const progression = getProgression({
      completedCount: DEFAULT_ECONOMY_CONFIG.rankTier5Tasks,
      streak: 0,
      todayCount: 0,
    })

    expect(progression.nextRank).toBeNull()
    expect(progression.rankSpan).toBe(0)
    expect(progression.tasksToNextRank).toBe(0)
  })
})
