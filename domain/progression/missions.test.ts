import { describe, expect, it } from 'vitest'
import {
  MISSION_KEYS,
  buildMissionProgress,
  claimableMissions,
  hasUnclaimedMissions,
  isMissionKey,
  missionDefinition,
} from './missions'

describe('missions', () => {
  it('menerima hanya kunci misi yang dikenal', () => {
    for (const key of MISSION_KEYS) expect(isMissionKey(key)).toBe(true)
    expect(isMissionKey('credits')).toBe(false)
  })

  it('membatasi progres pada rentang nol sampai target', () => {
    const list = buildMissionProgress(
      { tasks: -1, stars: missionDefinition('stars').target, ads: Number.MAX_SAFE_INTEGER },
      ['stars'],
    )

    expect(list.find((mission) => mission.key === 'tasks')?.progress).toBe(0)
    expect(list.find((mission) => mission.key === 'stars')).toMatchObject({ done: true, claimed: true })
    expect(list.find((mission) => mission.key === 'ads')).toMatchObject({
      progress: missionDefinition('ads').target,
      done: true,
    })
  })

  it('hanya mengembalikan misi selesai yang belum diklaim', () => {
    const list = buildMissionProgress(
      {
        tasks: missionDefinition('tasks').target,
        stars: missionDefinition('stars').target,
        ads: 0,
      },
      ['stars'],
    )

    expect(claimableMissions(list).map((mission) => mission.key)).toEqual(['tasks'])
  })

  it('menandai semua misi yang belum diklaim, terlepas dari progresnya', () => {
    const incomplete = buildMissionProgress({ tasks: 0, stars: 0, ads: 0 }, [])
    expect(hasUnclaimedMissions(incomplete)).toBe(true)

    const claimable = buildMissionProgress(
      {
        tasks: missionDefinition('tasks').target,
        stars: missionDefinition('stars').target,
        ads: missionDefinition('ads').target,
      },
      ['stars', 'ads'],
    )
    expect(hasUnclaimedMissions(claimable)).toBe(true)

    const allClaimed = buildMissionProgress({ tasks: 0, stars: 0, ads: 0 }, MISSION_KEYS)
    expect(hasUnclaimedMissions(allClaimed)).toBe(false)
  })
})
