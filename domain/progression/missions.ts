/** Misi harian: aturan murni, tanpa I/O. Hadiahnya energi, bukan credit, supaya misi mempercepat user mencapai plafon reward tanpa menambah liabilitas payout. Misi otomatis dihitung ulang dari sumber aslinya; misi sosial hanya menyimpan awal aksi dan klaim, karena platform sosial tidak memberi bukti kepemilikan akun yang aman untuk diverifikasi dari Mini App. */

import { adsConfigured } from '../ads/ads.ts'
import { economyConfig } from '../economy/economy-config.ts'

export type AutomaticMissionKey = 'tasks' | 'stars' | 'ads'
export type SocialMissionKey = 'twitter_follow' | 'twitter_post' | 'facebook_post'
export type MissionKey = AutomaticMissionKey | SocialMissionKey
export type SocialMissionAction = 'twitter_follow' | 'twitter_post' | 'facebook_post'

interface MissionDefinitionBase {
  key: MissionKey
  title: string
  /** Berapa yang harus dikumpulkan hari itu. */
  target: number
  /** Energi yang diberikan saat diklaim. */
  reward: number
}

export interface AutomaticMissionDefinition extends MissionDefinitionBase {
  key: AutomaticMissionKey
  kind: 'automatic'
}

export interface SocialMissionDefinition extends MissionDefinitionBase {
  key: SocialMissionKey
  kind: 'social'
  action: SocialMissionAction
  /** Follow hanya sekali seumur akun; kedua post kembali tersedia setiap hari WIB. */
  cadence: 'once' | 'daily'
}

export type MissionDefinition = AutomaticMissionDefinition | SocialMissionDefinition

/** Kunci ini juga dipatok constraint `mission_claims_known_key`; menambah kunci harus selalu disertai migrasi. */
export const MISSION_KEYS: readonly MissionKey[] = [
  'tasks',
  'stars',
  'ads',
  'twitter_follow',
  'twitter_post',
  'facebook_post',
]

export const SOCIAL_MISSION_KEYS: readonly SocialMissionKey[] = [
  'twitter_follow',
  'twitter_post',
  'facebook_post',
]

export const SOCIAL_MISSION_COOLDOWN_MS = 10_000

/** Katalog lengkap, termasuk misi iklan yang mungkin sedang tidak tersedia. */
function missionCatalog(): MissionDefinition[] {
  const config = economyConfig()
  return [
    {
      key: 'tasks',
      kind: 'automatic',
      title: `Selesaikan ${config.missionTasksTarget} task`,
      target: config.missionTasksTarget,
      reward: config.missionTasksReward,
    },
    {
      key: 'stars',
      kind: 'automatic',
      title: `Dapat ${config.missionStarsTarget} task bintang tiga`,
      target: config.missionStarsTarget,
      reward: config.missionStarsReward,
    },
    {
      key: 'ads',
      kind: 'automatic',
      title: `Tonton ${config.missionAdsTarget} iklan`,
      target: config.missionAdsTarget,
      reward: config.missionAdsReward,
    },
    {
      key: 'twitter_follow',
      kind: 'social',
      action: 'twitter_follow',
      cadence: 'once',
      title: 'Follow Twitter Tugas Duit',
      target: 1,
      reward: config.missionTwitterFollowReward,
    },
    {
      key: 'twitter_post',
      kind: 'social',
      action: 'twitter_post',
      cadence: 'daily',
      title: 'Post di Twitter',
      target: 1,
      reward: config.missionTwitterPostReward,
    },
    {
      key: 'facebook_post',
      kind: 'social',
      action: 'facebook_post',
      cadence: 'daily',
      title: 'Post di Facebook',
      target: 1,
      reward: config.missionFacebookPostReward,
    },
  ]
}

/** Misi iklan ikut mati saat jatah iklan nol; misi sosial tetap tersedia tanpa bergantung pada provider iklan. */
export function missions(): MissionDefinition[] {
  return missionCatalog().filter((mission) => mission.key !== 'ads' || adsConfigured())
}

export function isMissionKey(value: unknown): value is MissionKey {
  return typeof value === 'string' && MISSION_KEYS.includes(value as MissionKey)
}

export function isSocialMissionKey(value: unknown): value is SocialMissionKey {
  return typeof value === 'string' && SOCIAL_MISSION_KEYS.includes(value as SocialMissionKey)
}

export function isMissionAvailable(key: MissionKey): boolean {
  return missions().some((mission) => mission.key === key)
}

export function missionDefinition(key: MissionKey): MissionDefinition {
  const found = missionCatalog().find((mission) => mission.key === key)
  if (!found) throw new Error(`Misi tidak dikenal: ${key}`)
  return found
}

export interface MissionProgress {
  key: MissionKey
  kind: 'automatic' | 'social'
  title: string
  target: number
  reward: number
  progress: number
  done: boolean
  claimed: boolean
  action: SocialMissionAction | null
  cadence: 'once' | 'daily' | null
  /** Waktu server saat konfirmasi boleh dilakukan; tetap hidup saat sheet ditutup atau halaman dimuat ulang. */
  confirmAt: number | null
}

export interface MissionCounts {
  tasks: number
  stars: number
  ads: number
}

export function buildMissionProgress(
  counts: MissionCounts,
  claimed: readonly MissionKey[],
  confirmAt: Partial<Record<SocialMissionKey, number>> = {},
): MissionProgress[] {
  return missions().map((mission) => {
    const isClaimed = claimed.includes(mission.key)
    const progress =
      mission.kind === 'automatic'
        ? Math.max(0, Math.min(mission.target, counts[mission.key]))
        : isClaimed
          ? mission.target
          : 0
    const done = mission.kind === 'automatic' ? counts[mission.key] >= mission.target : isClaimed

    return {
      key: mission.key,
      kind: mission.kind,
      title: mission.title,
      target: mission.target,
      reward: mission.reward,
      progress,
      done,
      claimed: isClaimed,
      action: mission.kind === 'social' ? mission.action : null,
      cadence: mission.kind === 'social' ? mission.cadence : null,
      actionStartedAt: mission.kind === 'social' ? (actionStartedAt[mission.key] ?? null) : null,
    }
  })
}

export function claimableMissions(list: readonly MissionProgress[]): MissionProgress[] {
  return list.filter((mission) => mission.done && !mission.claimed)
}

/** Nav mengingatkan selama masih ada hadiah misi yang belum diambil. */
export function hasUnclaimedMissions(list: readonly MissionProgress[]): boolean {
  return list.some((mission) => !mission.claimed)
}
