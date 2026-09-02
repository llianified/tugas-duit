/** Misi harian: aturan murni, tanpa I/O. Hadiahnya **energi**, bukan credit, dan itu keputusan ekonomi bukan selera. Kolam reward (`domain/reward-pool.ts`) sudah mematok berapa credit yang bisa dibayar dalam sehari; energi tambahan tidak menggeser plafon itu sedikit pun — ia hanya membuat user sampai ke plafonnya lebih cepat, lewat lebih banyak task. Jadi misi menambah alasan untuk kembali dan menambah tayangan iklan, tanpa menambah satu rupiah pun yang harus dibayarkan. Hadiah berupa credit akan menjadi liabilitas baru **di atas** kolam. Kemajuannya tidak disimpan di mana pun: ketiganya dihitung ulang dari tabel yang sudah ada (`task_completions`, `ad_views`). Yang tersimpan hanya klaimnya, satu baris per user per hari per misi. Tanpa itu, ada dua sumber kebenaran untuk hal yang sama dan keduanya pasti berselisih suatu saat. */

import { economyConfig } from './economy-config.ts'

export type MissionKey = 'tasks' | 'stars' | 'ads'

export interface MissionDefinition {
  key: MissionKey
  title: string
  /** Berapa yang harus dikumpulkan hari itu. */
  target: number
  /** Energi yang diberikan saat diklaim. */
  reward: number
}

/** Kuncinya tetap konstanta, targetnya dan hadiahnya tidak. Tiga kunci ini terpaku pada `mission_claims_known_key` di migrasi 0031, jadi menambah misi baru memang menuntut migrasi — dan memang seharusnya, karena kemajuan tiap misi dihitung dari kolom yang berbeda. Yang tidak punya alasan untuk menuntut deploy adalah besarannya: berapa yang harus dikumpulkan, dan berapa energi yang dibayarkan. Keduanya sekarang dari `economy-config`, seperti seluruh besaran lain di aplikasi ini. Judulnya ikut menyebut targetnya, jadi ia ikut berubah begitu targetnya disetel — teks misi yang mengatakan "5 task" sementara servernya menuntut 8 adalah bentuk kesalahan yang paling merusak untuk daftar yang seluruh gunanya menunjukkan progres. */
export const MISSION_KEYS: readonly MissionKey[] = ['tasks', 'stars', 'ads']

export function missions(): MissionDefinition[] {
  const config = economyConfig()
  return [
    {
      key: 'tasks',
      title: `Selesaikan ${config.missionTasksTarget} task`,
      target: config.missionTasksTarget,
      reward: config.missionTasksReward,
    },
    {
      key: 'stars',
      title: `Dapat ${config.missionStarsTarget} task bintang tiga`,
      target: config.missionStarsTarget,
      reward: config.missionStarsReward,
    },
    {
      key: 'ads',
      title: `Tonton ${config.missionAdsTarget} iklan`,
      target: config.missionAdsTarget,
      reward: config.missionAdsReward,
    },
  ]
}

export function isMissionKey(value: unknown): value is MissionKey {
  return typeof value === 'string' && MISSION_KEYS.includes(value as MissionKey)
}

export function missionDefinition(key: MissionKey): MissionDefinition {
  const found = missions().find((mission) => mission.key === key)
  if (!found) throw new Error(`Misi tidak dikenal: ${key}`)
  return found
}

export interface MissionProgress {
  key: MissionKey
  title: string
  target: number
  reward: number
  progress: number
  done: boolean
  claimed: boolean
}

export interface MissionCounts {
  tasks: number
  stars: number
  ads: number
}

export function buildMissionProgress(
  counts: MissionCounts,
  claimed: readonly MissionKey[],
): MissionProgress[] {
  return missions().map((mission) => {
    const progress = Math.max(0, Math.min(mission.target, counts[mission.key]))
    return {
      key: mission.key,
      title: mission.title,
      target: mission.target,
      reward: mission.reward,
      progress,
      done: counts[mission.key] >= mission.target,
      claimed: claimed.includes(mission.key),
    }
  })
}

export function claimableMissions(list: readonly MissionProgress[]): MissionProgress[] {
  return list.filter((mission) => mission.done && !mission.claimed)
}
