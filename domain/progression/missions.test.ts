import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '../economy/economy-config'
import {
  MISSION_KEYS,
  buildMissionProgress,
  claimableMissions,
  hasUnclaimedMissions,
  isMissionAvailable,
  isMissionKey,
  missionDefinition,
  missions,
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

  it('membedakan misi sekali per akun dari post harian dan membawa waktu konfirmasi', () => {
    const confirmAt = Date.now() + 10_000
    const list = buildMissionProgress(
      { tasks: 0, stars: 0, ads: 0 },
      ['twitter_follow'],
      { twitter_like_repost: confirmAt, twitter_post: confirmAt },
    )

    expect(list.find((mission) => mission.key === 'twitter_follow')).toMatchObject({
      kind: 'social',
      cadence: 'once',
      claimed: true,
    })
    expect(list.find((mission) => mission.key === 'twitter_like_repost')).toMatchObject({
      kind: 'social',
      cadence: 'once',
      confirmAt,
      claimed: false,
    })
    expect(list.find((mission) => mission.key === 'twitter_post')).toMatchObject({
      kind: 'social',
      cadence: 'daily',
      confirmAt,
      claimed: false,
    })
  })

  it('memetakan setiap misi sosial ke reward konfigurasinya sendiri', () => {
    setActiveEconomyConfig({
      ...DEFAULT_ECONOMY_CONFIG,
      missionTwitterFollowReward: 2,
      missionTwitterLikeRepostReward: 3,
      missionTwitterPostReward: 4,
      missionFacebookPostReward: 5,
    })
    try {
      expect(missionDefinition('twitter_follow').reward).toBe(2)
      expect(missionDefinition('twitter_like_repost').reward).toBe(3)
      expect(missionDefinition('twitter_post').reward).toBe(4)
      expect(missionDefinition('facebook_post').reward).toBe(5)
    } finally {
      setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
    }
  })
})

describe('misi iklan mengikuti tombol mati iklan', () => {
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('menerbitkan misi otomatis dan sosial selama iklan menyala', () => {
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, adsMaxViewsPerDay: 10 })
    expect(missions().map((mission) => mission.key)).toEqual([
      'tasks',
      'stars',
      'ads',
      'twitter_follow',
      'twitter_like_repost',
      'twitter_post',
      'facebook_post',
    ])
    expect(isMissionAvailable('ads')).toBe(true)
  })

  /** Misi yang mustahil lebih buruk daripada misi yang hilang: progresnya berhenti di 0/N selamanya, dan karena `hasUnclaimedMissions` menyala selama masih ada yang belum diklaim, titik pengingat di nav ikut menyala permanen tanpa satu pun cara membersihkannya. */
  it('berhenti menerbitkan misi iklan saat plafon tayangannya nol', () => {
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, adsMaxViewsPerDay: 0 })
    expect(missions().map((mission) => mission.key)).toEqual([
      'tasks',
      'stars',
      'twitter_follow',
      'twitter_like_repost',
      'twitter_post',
      'facebook_post',
    ])
    expect(isMissionAvailable('ads')).toBe(false)

    const list = buildMissionProgress(
      { tasks: 0, stars: 0, ads: 0 },
      [
        'tasks',
        'stars',
        'twitter_follow',
        'twitter_like_repost',
        'twitter_post',
        'facebook_post',
      ],
    )
    expect(hasUnclaimedMissions(list)).toBe(false)
  })

  /** Katalognya tetap utuh: kunci `ads` masih dikenal (`mission_claims_known_key` di migrasi 0031 tidak berubah) dan targetnya masih bisa dibaca — yang berubah hanya apa yang diterbitkan. */
  it('tetap mengenali kunci dan targetnya walau misinya tidak diterbitkan', () => {
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, adsMaxViewsPerDay: 0 })
    expect(isMissionKey('ads')).toBe(true)
    expect(missionDefinition('ads').target).toBe(DEFAULT_ECONOMY_CONFIG.missionAdsTarget)
  })
})
