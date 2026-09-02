import { describe, expect, it } from 'vitest'
import {
  MISSION_KEYS,
  buildMissionProgress,
  claimableMissions,
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
})
