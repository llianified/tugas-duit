import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '../economy/economy-config'
import {
  MISSION_KEYS,
  ONCE_SOCIAL_MISSION_KEYS,
  SOCIAL_MISSION_KEYS,
  buildMissionProgress,
  claimableMissions,
  hasUnclaimedMissions,
  isMissionAvailable,
  isMissionKey,
  missionDefinition,
  missions,
  rotateAutomaticMissions,
  todayWib,
  type MissionCounts,
} from './missions'

/** Undian misi harian berganti tiap hari WIB, jadi test yang tidak memaku tanggalnya akan lulus
 * hari ini dan gagal besok. Tanggal ini dipilih karena undiannya memuat ketiga misi otomatis yang
 * sudah ada sebelum rotasi, sehingga test lama tetap menguji hal yang sama. */
const HARI = '2026-09-04'
const hitung = (partial: Partial<MissionCounts> = {}): MissionCounts => ({
  tasks: 0, stars: 0, ads: 0, hard: 0, arcade: 0, variety: 0, ...partial,
})

describe('missions', () => {
  /** Undian dibuka penuh untuk kelompok ini: yang diuji di sini logika progres dan klaim, bukan
   * misi mana yang kebagian terbit hari itu. Rotasinya diuji terpisah di bawah. */
  beforeEach(() =>
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, missionDailyCount: 6, arcadeEnabled: 1 }),
  )
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('menerima hanya kunci misi yang dikenal', () => {
    for (const key of MISSION_KEYS) expect(isMissionKey(key)).toBe(true)
    expect(isMissionKey('credits')).toBe(false)
  })

  it('membatasi progres pada rentang nol sampai target', () => {
    const list = buildMissionProgress(
      hitung({ tasks: -1, stars: missionDefinition('stars').target, ads: Number.MAX_SAFE_INTEGER }),
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
      hitung({
          tasks: missionDefinition('tasks').target,
          stars: missionDefinition('stars').target,
          ads: 0,
        }),
      ['stars'],
    )

    expect(claimableMissions(list).map((mission) => mission.key)).toEqual(['tasks'])
  })

  it('menandai semua misi yang belum diklaim, terlepas dari progresnya', () => {
    const incomplete = buildMissionProgress(hitung({ tasks: 0, stars: 0, ads: 0 }), [])
    expect(hasUnclaimedMissions(incomplete)).toBe(true)

    const claimable = buildMissionProgress(
      hitung({
          tasks: missionDefinition('tasks').target,
          stars: missionDefinition('stars').target,
          ads: missionDefinition('ads').target,
        }),
      ['stars', 'ads'],
    )
    expect(hasUnclaimedMissions(claimable)).toBe(true)

    const allClaimed = buildMissionProgress(hitung({ tasks: 0, stars: 0, ads: 0 }), MISSION_KEYS)
    expect(hasUnclaimedMissions(allClaimed)).toBe(false)
  })

  it('membedakan misi sekali per akun dari post harian dan membawa waktu konfirmasi', () => {
    const confirmAt = Date.now() + 10_000
    const list = buildMissionProgress(
      hitung({ tasks: 0, stars: 0, ads: 0 }),
      ['tiktok_follow'],
      { whatsapp_channel: confirmAt, whatsapp_share: confirmAt },
    )

    expect(list.find((mission) => mission.key === 'tiktok_follow')).toMatchObject({
      kind: 'social',
      cadence: 'once',
      claimed: true,
    })
    expect(list.find((mission) => mission.key === 'whatsapp_channel')).toMatchObject({
      kind: 'social',
      cadence: 'once',
      confirmAt,
      claimed: false,
    })
    expect(list.find((mission) => mission.key === 'whatsapp_share')).toMatchObject({
      kind: 'social',
      cadence: 'daily',
      confirmAt,
      claimed: false,
    })
  })

  it('memetakan setiap misi sosial ke reward konfigurasinya sendiri', () => {
    setActiveEconomyConfig({
      ...DEFAULT_ECONOMY_CONFIG,
      missionFacebookPostReward: 5,
      missionWhatsappShareReward: 6,
      missionWhatsappChannelReward: 4,
      missionTiktokFollowReward: 7,
    })
    try {
      expect(missionDefinition('facebook_post').reward).toBe(5)
      expect(missionDefinition('whatsapp_share').reward).toBe(6)
      expect(missionDefinition('whatsapp_channel').reward).toBe(4)
      expect(missionDefinition('tiktok_follow').reward).toBe(7)
    } finally {
      setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
    }
  })
})

/** Daftar inilah yang dipakai `server/task/missions.ts` untuk memutuskan klaim mana yang berlaku
 * sepanjang umur akun. Sebelumnya ia ditulis tangan sebagai literal SQL di dua kueri, terpisah dari
 * `cadence` di katalog — dan misi `once` yang luput disalin ke sana akan terbit ulang tiap hari WIB
 * dengan energi yang bisa diklaim berkali-kali dari satu aksi yang sama. Yang dijaga di sini bukan
 * isi daftarnya, melainkan bahwa ia benar-benar diturunkan dari katalog. */
describe('irama misi sosial punya satu sumber', () => {
  beforeEach(() => setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, missionDailyCount: 6 }))
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('mendaftar persis misi sosial yang katalognya beririma sekali seumur akun', () => {
    const dariKatalog = SOCIAL_MISSION_KEYS.filter((key) => {
      const definisi = missionDefinition(key)
      return definisi.kind === 'social' && definisi.cadence === 'once'
    })

    expect([...ONCE_SOCIAL_MISSION_KEYS]).toEqual(dariKatalog)
  })

  it('memasukkan follow TikTok, bukan hanya peninggalan X', () => {
    expect(ONCE_SOCIAL_MISSION_KEYS).toContain('tiktok_follow')
    expect(ONCE_SOCIAL_MISSION_KEYS).not.toContain('whatsapp_share')
  })
})

describe('misi iklan mengikuti tombol mati iklan', () => {
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('menerbitkan misi otomatis dan sosial selama iklan menyala', () => {
    setActiveEconomyConfig({
      ...DEFAULT_ECONOMY_CONFIG, adsMaxViewsPerDay: 10, missionDailyCount: 6, arcadeEnabled: 1,
    })
    expect(missions(HARI).map((mission) => mission.key)).toEqual([
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
    ])
    expect(isMissionAvailable('ads')).toBe(true)
  })

  /** Misi yang mustahil lebih buruk daripada misi yang hilang: progresnya berhenti di 0/N selamanya, dan karena `hasUnclaimedMissions` menyala selama masih ada yang belum diklaim, titik pengingat di nav ikut menyala permanen tanpa satu pun cara membersihkannya. */
  it('berhenti menerbitkan misi iklan saat plafon tayangannya nol', () => {
    setActiveEconomyConfig({
      ...DEFAULT_ECONOMY_CONFIG, adsMaxViewsPerDay: 0, missionDailyCount: 6, arcadeEnabled: 1,
    })
    /** Misi Arena ikut hilang, dan itu memang benar: ongkos masuk Arena adalah pass iklan, jadi
     * `arcadeEnabled()` ikut tertutup saat tombol mati iklan menyala. Misi yang mustahil lebih
     * buruk daripada misi yang hilang. */
    expect(missions(HARI).map((mission) => mission.key)).toEqual([
      'tasks',
      'stars',
      'hard',
      'variety',
      'facebook_post',
      'whatsapp_share',
      'whatsapp_channel',
      'tiktok_follow',
    ])
    expect(isMissionAvailable('ads')).toBe(false)

    const list = buildMissionProgress(
      hitung(),
      [
        'tasks', 'stars', 'hard', 'variety',
        'facebook_post', 'whatsapp_share', 'whatsapp_channel', 'tiktok_follow',
      ],
      {},
      HARI,
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

describe('rotasi misi harian', () => {
  beforeEach(() =>
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, missionDailyCount: 3, arcadeEnabled: 1 }),
  )
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('menerbitkan sebanyak yang disetel, ditambah seluruh misi sosial', () => {
    const list = missions(HARI)
    expect(list.filter((m) => m.kind === 'automatic')).toHaveLength(3)
    /** Misi sosial tidak ikut diundi: dua di antaranya sekali seumur akun, jadi menyembunyikannya
     * di hari yang salah berarti user tidak pernah tahu ia ada. */
    expect(list.filter((m) => m.kind === 'social')).toHaveLength(SOCIAL_MISSION_KEYS.length)
  })

  it('memberi susunan yang sama untuk tanggal yang sama', () => {
    expect(missions(HARI).map((m) => m.key)).toEqual(missions(HARI).map((m) => m.key))
  })

  it('mengganti susunannya seiring hari berganti', () => {
    const susunan = new Set<string>()
    for (let hari = 1; hari <= 28; hari += 1) {
      susunan.add(
        missions(`2026-09-${String(hari).padStart(2, '0')}`)
          .filter((m) => m.kind === 'automatic')
          .map((m) => m.key)
          .join(','),
      )
    }
    /** Kolam 6 diambil 3 memberi 20 susunan yang mungkin; yang dijaga di sini cuma bahwa undiannya
     * benar-benar berputar, bukan berapa persis yang muncul dalam 28 hari. */
    expect(susunan.size).toBeGreaterThanOrEqual(8)
  })

  it('mempertahankan urutan katalog supaya daftarnya tidak melompat dalam satu hari', () => {
    const urutan = missions(HARI)
      .filter((m) => m.kind === 'automatic')
      .map((m) => m.key)
    const katalog = ['tasks', 'stars', 'ads', 'hard', 'arcade', 'variety']
    expect([...urutan].sort((a, b) => katalog.indexOf(a) - katalog.indexOf(b))).toEqual(urutan)
  })

  it('mengembalikan seluruh kolam saat yang diminta lebih banyak daripada isinya', () => {
    const kolam = missions(HARI).filter((m) => m.kind === 'automatic')
    expect(rotateAutomaticMissions(kolam, HARI, 99)).toHaveLength(kolam.length)
  })

  it('menghitung tanggal WIB, bukan UTC', () => {
    /** 31 Des 2025 17:00 UTC sudah 1 Jan 2026 di Jakarta. Kalau ini meleset, undian misi berganti
     * di jam yang berbeda dari batas hari yang dipakai klaimnya. */
    expect(todayWib(new Date('2025-12-31T17:00:00Z'))).toBe('2026-01-01')
    expect(todayWib(new Date('2025-12-31T16:59:00Z'))).toBe('2025-12-31')
  })
})
