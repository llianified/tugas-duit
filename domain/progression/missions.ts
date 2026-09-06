/** Misi harian: aturan murni, tanpa I/O. Hadiahnya energi, bukan credit, supaya misi mempercepat user mencapai plafon reward tanpa menambah liabilitas payout. Misi otomatis dihitung ulang dari sumber aslinya; misi sosial hanya menyimpan awal aksi dan klaim, karena platform sosial tidak memberi bukti kepemilikan akun yang aman untuk diverifikasi dari Mini App. */

import { adsConfigured } from '../ads/ads.ts'
import { arcadeEnabled } from '../arcade/arcade.ts'
import { economyConfig } from '../economy/economy-config.ts'

export type AutomaticMissionKey = 'tasks' | 'stars' | 'ads' | 'hard' | 'arcade' | 'variety'
export type SocialMissionKey =
  | 'facebook_post'
  | 'whatsapp_share'
  | 'whatsapp_channel'
  | 'tiktok_follow'
export type MissionKey = AutomaticMissionKey | SocialMissionKey

export const AUTOMATIC_MISSION_KEYS: readonly AutomaticMissionKey[] = [
  'tasks', 'stars', 'ads', 'hard', 'arcade', 'variety',
]
export type SocialMissionAction = SocialMissionKey

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
  /** Follow dan aksi pada post tetap hanya sekali seumur akun; post referral tersedia setiap hari WIB. */
  cadence: 'once' | 'daily'
}

export type MissionDefinition = AutomaticMissionDefinition | SocialMissionDefinition

/** Kunci ini juga dipatok constraint `mission_claims_known_key`; menambah kunci harus selalu disertai migrasi. */
export const MISSION_KEYS: readonly MissionKey[] = [
  'tasks',
  'stars',
  'ads',
  'hard',
  'arcade',
  'variety',
  'facebook_post',
  'whatsapp_share',
  'whatsapp_channel',
  'tiktok_follow',
]

export const SOCIAL_MISSION_KEYS: readonly SocialMissionKey[] = [
  'facebook_post',
  'whatsapp_share',
  'whatsapp_channel',
  'tiktok_follow',
]

/** Irama tiap misi sosial, dipisah dari katalog supaya bisa dibaca tanpa konfigurasi ekonomi aktif.
 * `server/task/missions.ts` menurunkan daftar misi sekali-seumur-akun dari sini pada waktu impor,
 * dan `missionCatalog()` membacanya juga — jadi satu key tidak bisa punya dua irama yang berbeda.
 * Sebelumnya daftar itu ditulis tangan sebagai literal SQL di dua tempat, dan misi `once` yang lupa
 * didaftarkan akan diam-diam terbit ulang tiap hari WIB: energinya bisa diklaim berkali-kali dari
 * satu aksi yang sama, tanpa satu pun test yang keberatan. */
const SOCIAL_MISSION_CADENCE: Record<SocialMissionKey, 'once' | 'daily'> = {
  facebook_post: 'daily',
  whatsapp_share: 'daily',
  whatsapp_channel: 'once',
  tiktok_follow: 'once',
}

/** Misi sosial yang klaimnya berlaku sepanjang umur akun, bukan hanya hari WIB berjalan. */
export const ONCE_SOCIAL_MISSION_KEYS: readonly SocialMissionKey[] = SOCIAL_MISSION_KEYS.filter(
  (key) => SOCIAL_MISSION_CADENCE[key] === 'once',
)

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
      key: 'hard',
      kind: 'automatic',
      title: `Selesaikan ${config.missionHardTarget} task Sulit`,
      target: config.missionHardTarget,
      reward: config.missionHardReward,
    },
    {
      key: 'arcade',
      kind: 'automatic',
      title: `Main ${config.missionArcadeTarget} ronde Arena`,
      target: config.missionArcadeTarget,
      reward: config.missionArcadeReward,
    },
    {
      key: 'variety',
      kind: 'automatic',
      title: `Kerjakan ${config.missionVarietyTarget} jenis soal berbeda`,
      target: config.missionVarietyTarget,
      reward: config.missionVarietyReward,
    },
    {
      key: 'facebook_post',
      kind: 'social',
      action: 'facebook_post',
      cadence: SOCIAL_MISSION_CADENCE.facebook_post,
      title: 'Post di Facebook',
      target: 1,
      reward: config.missionFacebookPostReward,
    },
    /** Yang dibagikan bukan status, melainkan pesan ke kontak atau grup: WhatsApp tidak punya
     * tautan yang membuka komposer Status di semua perangkat, jadi misi yang menyuruh "pasang di
     * Status" akan menjanjikan langkah yang tombolnya sendiri tidak bisa antar. */
    {
      key: 'whatsapp_share',
      kind: 'social',
      action: 'whatsapp_share',
      cadence: SOCIAL_MISSION_CADENCE.whatsapp_share,
      title: 'Bagikan ke grup WhatsApp',
      target: 1,
      reward: config.missionWhatsappShareReward,
    },
    /** Join channel, bukan bagikan: channel WhatsApp punya tautan undangan yang membuka layar join
     * langsung, jadi langkahnya bisa diantar tombol sampai selesai. Sekali seumur akun karena
     * join memang cuma terjadi sekali — sama seperti follow TikTok. */
    {
      key: 'whatsapp_channel',
      kind: 'social',
      action: 'whatsapp_channel',
      cadence: SOCIAL_MISSION_CADENCE.whatsapp_channel,
      title: 'Join channel WhatsApp Tugas Duit',
      target: 1,
      reward: config.missionWhatsappChannelReward,
    },
    /** Follow saja, bukan bikin video: TikTok tidak menyediakan tautan yang mengisi komposernya,
     * jadi misi membuat konten menuntut peninjauan manual yang belum ada tempatnya di panel. */
    {
      key: 'tiktok_follow',
      kind: 'social',
      action: 'tiktok_follow',
      cadence: SOCIAL_MISSION_CADENCE.tiktok_follow,
      title: 'Follow TikTok Tugas Duit',
      target: 1,
      reward: config.missionTiktokFollowReward,
    },
  ]
}

/** Undian misi harian, sama untuk semua user dan berganti tiap hari WIB.
 *
 * Sengaja global, bukan per user: susunan misi hari ini jadi sesuatu yang bisa dibicarakan bersama
 * di channel, dan tidak ada user yang merasa kebagian hari yang lebih berat daripada temannya.
 * Sengaja pula tanpa penyimpanan — hasilnya diturunkan dari tanggalnya, jadi tiap server dan tiap
 * request sampai pada susunan yang sama tanpa perlu satu baris tabel pun.
 *
 * Yang diundi hanya misi otomatis. Misi sosial tetap terbit tiap hari karena ia jalur yang berbeda:
 * dua di antaranya sekali seumur akun, dan menyembunyikannya di hari yang salah berarti user tidak
 * pernah tahu ia ada. */
function seedFromDate(wibDate: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < wibDate.length; index += 1) {
    hash ^= wibDate.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619) >>> 0
  }
  return hash
}

export function rotateAutomaticMissions(
  pool: readonly MissionDefinition[],
  wibDate: string,
  take: number,
): MissionDefinition[] {
  if (pool.length <= take) return [...pool]
  /** Fisher-Yates dengan sumber acak yang deterministik terhadap tanggalnya. */
  const order = [...pool]
  let seed = seedFromDate(wibDate)
  for (let index = order.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
    const swapWith = seed % (index + 1)
    ;[order[index], order[swapWith]] = [order[swapWith], order[index]]
  }
  /** Urutan tampilnya dikembalikan ke urutan katalog supaya daftar misi tidak ikut melompat-lompat
   * dalam satu hari yang sama. */
  const chosen = new Set(order.slice(0, take).map((mission) => mission.key))
  return pool.filter((mission) => chosen.has(mission.key))
}

/** Misi iklan ikut mati saat jatah iklan nol, dan misi Arena ikut mati saat Arena ditutup: misi yang
 * mustahil lebih buruk daripada misi yang hilang. */
function availableCatalog(): MissionDefinition[] {
  return missionCatalog().filter((mission) => {
    if (mission.key === 'ads') return adsConfigured()
    if (mission.key === 'arcade') return arcadeEnabled()
    return true
  })
}

export function missions(wibDate: string = todayWib()): MissionDefinition[] {
  const catalog = availableCatalog()
  const automatic = catalog.filter((mission) => mission.kind === 'automatic')
  const social = catalog.filter((mission) => mission.kind === 'social')
  const drawn = rotateAutomaticMissions(automatic, wibDate, economyConfig().missionDailyCount)
  return [...drawn, ...social]
}

/** Tanggal WIB hari ini. Harus sama persis dengan `(now() at time zone 'Asia/Jakarta')::date` di SQL,
 * karena batas hari untuk klaim misi datang dari sana. */
export function todayWib(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isMissionKey(value: unknown): value is MissionKey {
  return typeof value === 'string' && MISSION_KEYS.includes(value as MissionKey)
}

export function isSocialMissionKey(value: unknown): value is SocialMissionKey {
  return typeof value === 'string' && SOCIAL_MISSION_KEYS.includes(value as SocialMissionKey)
}

export function isMissionAvailable(key: MissionKey, wibDate: string = todayWib()): boolean {
  return missions(wibDate).some((mission) => mission.key === key)
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

/** Dikunci ke `AutomaticMissionKey` supaya menambah misi otomatis tidak bisa lupa menambah
 * penghitungnya — tanpa ini, misi baru terbit dengan progres yang diam di nol dan gagalnya tidak
 * terlihat sampai ada user yang mengeluh. */
export type MissionCounts = Record<AutomaticMissionKey, number>

export function buildMissionProgress(
  counts: MissionCounts,
  claimed: readonly MissionKey[],
  confirmAt: Partial<Record<SocialMissionKey, number>> = {},
  /** Tanggal WIB yang menentukan undian hari itu. Dikirim pemanggil, bukan dibaca dari jam proses:
   * batas hari untuk klaim datang dari `(now() at time zone 'Asia/Jakarta')::date` di Postgres, dan
   * dua sumber jam yang berbeda akan menerbitkan susunan misi yang tidak cocok dengan klaimnya
   * tepat di sekitar tengah malam. */
  wibDate: string = todayWib(),
): MissionProgress[] {
  return missions(wibDate).map((mission) => {
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
      confirmAt: mission.kind === 'social' ? (confirmAt[mission.key] ?? null) : null,
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
