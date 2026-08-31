/**
 * Misi harian: aturan murni, tanpa I/O.
 *
 * Hadiahnya **energi**, bukan credit, dan itu keputusan ekonomi bukan selera. Kolam
 * reward (`domain/reward-pool.ts`) sudah mematok berapa credit yang bisa dibayar dalam
 * sehari; energi tambahan tidak menggeser plafon itu sedikit pun — ia hanya membuat user
 * sampai ke plafonnya lebih cepat, lewat lebih banyak task. Jadi misi menambah alasan
 * untuk kembali dan menambah tayangan iklan, tanpa menambah satu rupiah pun yang harus
 * dibayarkan. Hadiah berupa credit akan menjadi liabilitas baru **di atas** kolam.
 *
 * Kemajuannya tidak disimpan di mana pun: ketiganya dihitung ulang dari tabel yang sudah
 * ada (`task_completions`, `ad_views`). Yang tersimpan hanya klaimnya, satu baris per
 * user per hari per misi. Tanpa itu, ada dua sumber kebenaran untuk hal yang sama dan
 * keduanya pasti berselisih suatu saat.
 */

export type MissionKey = 'tasks' | 'stars' | 'ads'

export interface MissionDefinition {
  key: MissionKey
  title: string
  /** Berapa yang harus dikumpulkan hari itu. */
  target: number
  /** Energi yang diberikan saat diklaim. */
  reward: number
}

export const MISSIONS: readonly MissionDefinition[] = [
  { key: 'tasks', title: 'Selesaikan 5 task', target: 5, reward: 2 },
  { key: 'stars', title: 'Dapat 3 task bintang tiga', target: 3, reward: 2 },
  { key: 'ads', title: 'Tonton 3 iklan', target: 3, reward: 3 },
]

export const MISSION_KEYS: readonly MissionKey[] = MISSIONS.map((mission) => mission.key)

export function isMissionKey(value: unknown): value is MissionKey {
  return typeof value === 'string' && MISSION_KEYS.includes(value as MissionKey)
}

export function missionDefinition(key: MissionKey): MissionDefinition {
  const found = MISSIONS.find((mission) => mission.key === key)
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
  return MISSIONS.map((mission) => {
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
