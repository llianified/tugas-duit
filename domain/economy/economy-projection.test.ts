import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from './economy-config'
import {
  BEHAVIOR_PROFILES,
  averageReward,
  poolCreditsPerDay,
  projectEconomy,
  projectSegment,
  type BehaviorProfile,
} from './economy-projection'

/** Config yang benar-benar berjalan di produksi pada 4 Sep 2026 (versi 144), yaitu hari yang
 * dipakai mengkalibrasi seluruh profil. Ditulis utuh, bukan patch di atas bawaan repo, supaya
 * test ini tetap mengunci angka yang sama walau `DEFAULT_ECONOMY_CONFIG` bergeser. */
const LIVE: EconomyConfig = {
  ...DEFAULT_ECONOMY_CONFIG,
  creditValueIdr: 100,
  rewardPoolCapIdr: 5_000,
  rewardPoolRegenMinutes: 1,
  rewardPoolRegenCredits: 5,
  maxTasksPerDay: 150,
  rewardEasy1: 1, rewardEasy2: 2, rewardEasy3: 3,
  rewardMedium1: 4, rewardMedium2: 5, rewardMedium3: 6,
  rewardHard1: 7, rewardHard2: 8, rewardHard3: 9,
  maxEnergy: 3,
  energyRegenMinutes: 100,
  energyCostPerTask: 1,
  adsMaxViewsPerDay: 50,
  arcadeMaxPlaysPerDay: 10,
  arcadeAdGated: 1,
  arcadePoolPrizeCredits: 50,
  arcadePoolPrizeWeight: 2,
  arcadeEnergyPrizeAmount: 1,
  arcadeEnergyPrizeWeight: 1,
  arcadeBlankWeight: 0,
  missionTasksReward: 1,
  missionStarsReward: 2,
  missionAdsReward: 2,
  missionFacebookPostReward: 1,
  missionWhatsappShareReward: 1,
  withdrawalMinimumIdr: 25_000,
}

const bySegment = (id: string) => {
  const profile = BEHAVIOR_PROFILES.find((p) => p.id === id)
  if (!profile) throw new Error(`profil ${id} hilang`)
  return projectSegment(LIVE, profile)
}

describe('PROJ-1 kalibrasi terhadap produksi', () => {
  /** Ini satu-satunya test yang membuat modul ini berarti. Angka pembandingnya adalah median task
   * tiap kuartil pada 4 Sep 2026 — 3, 7, 12, 26, 59. Kalau rumusnya digeser dan test ini gagal,
   * yang salah rumusnya, bukan angkanya. */
  it.each([
    ['nyoba', 3],
    ['kasual', 7],
    ['kasual-rajin', 12],
    ['rajin', 26],
    ['grinder', 59],
  ])('mereproduksi median task segmen %s (%i task)', (id, observed) => {
    /** Toleransi relatif, bukan absolut: ini model perilaku, dan meleset satu task pada segmen
     * yang mengerjakan 59 berarti hal yang sangat berbeda daripada pada segmen yang mengerjakan 3. */
    const projected = bySegment(id).tasksPerDay
    expect(Math.abs(projected - observed) / observed).toBeLessThan(0.12)
  })

  it('mereproduksi reward rata-rata 5,61 credit per task', () => {
    expect(averageReward(LIVE)).toBeCloseTo(5.61, 1)
  })

  it('mereproduksi penghasilan median harian sekitar Rp 5.000', () => {
    expect(bySegment('kasual-rajin').rupiahPerDay).toBeGreaterThan(5_000)
    expect(bySegment('kasual').rupiahPerDay).toBeLessThan(5_000)
  })
})

describe('PROJ-2 pengikat', () => {
  /** Temuan yang menggerakkan seluruh keputusan: 75% user tertahan ENERGI, bukan kolam. Panel harus
   * menunjuk field yang benar, karena menaikkan kolam untuk user ini tidak menambah satu task pun. */
  it.each(['nyoba', 'kasual', 'kasual-rajin'])('menyebut tangki energi sebagai pengikat segmen %s', (id) => {
    expect(bySegment(id).bottleneck).toBe('tangki energi')
  })

  it('menyebut iklan sebagai pengikat grinder yang menghabiskan plafon tayangan', () => {
    expect(bySegment('grinder').bottleneck).toBe('iklan')
  })

  it('menyebut stok reward saat kolam lebih kecil daripada yang sanggup dikerjakan user', () => {
    const kering: EconomyConfig = { ...LIVE, rewardPoolRegenMinutes: 1_440, rewardPoolRegenCredits: 1 }
    expect(projectSegment(kering, BEHAVIOR_PROFILES[4]).bottleneck).toBe('stok reward')
  })

  it('menyebut plafon harian saat kesempatan melewatinya sebelum kolam mentok', () => {
    const longgar: EconomyConfig = { ...LIVE, maxTasksPerDay: 5, rewardPoolRegenCredits: 100 }
    expect(projectSegment(longgar, BEHAVIOR_PROFILES[4]).bottleneck).toBe('plafon harian')
  })
})

describe('PROJ-3 arah pengungkit', () => {
  /** Inti rekomendasinya, dan pembedaan yang paling mudah salah: yang membuka sesi user kasual
   * adalah TANGKI energi, bukan kecepatan regennya. Kalau arah ini terbalik, config yang berdiri
   * di atasnya ikut salah sasaran. */
  it('tangki energi lebih besar menaikkan kasual jauh lebih banyak daripada grinder', () => {
    const tangki: EconomyConfig = { ...LIVE, maxEnergy: 8 }
    const naikKasual =
      projectSegment(tangki, BEHAVIOR_PROFILES[1]).tasksPerDay / bySegment('kasual').tasksPerDay
    const naikGrinder =
      projectSegment(tangki, BEHAVIOR_PROFILES[4]).tasksPerDay / bySegment('grinder').tasksPerDay
    expect(naikKasual).toBeGreaterThan(naikGrinder * 1.5)
  })

  /** Kebalikannya, dan ini yang menyelamatkan uang: mempercepat regen TIDAK menolong user yang
   * tangkinya sudah penuh sebelum ia kembali. Jeda kunjungan kasual 10 jam; regen 100 menit sudah
   * mengisi 6 energi ke tangki yang cuma muat 3. */
  it('regen lebih cepat tidak menambah apa pun untuk user yang tangkinya sudah penuh', () => {
    const cepat: EconomyConfig = { ...LIVE, energyRegenMinutes: 20 }
    for (const id of ['nyoba', 'kasual', 'kasual-rajin']) {
      const profile = BEHAVIOR_PROFILES.find((p) => p.id === id)!
      expect(projectSegment(cepat, profile).tasksPerDay).toBeCloseTo(bySegment(id).tasksPerDay, 5)
    }
  })

  /** Kebalikannya, dan ini yang membuat "bakar duit lewat kolam" meleset: memperbesar kolam tidak
   * menyentuh satu pun segmen yang tertahan energi. */
  it('memperbesar kolam tidak menambah task untuk segmen yang tertahan energi', () => {
    const besar: EconomyConfig = { ...LIVE, rewardPoolRegenCredits: 50, rewardPoolCapIdr: 100_000 }
    for (const id of ['nyoba', 'kasual', 'kasual-rajin']) {
      const profile = BEHAVIOR_PROFILES.find((p) => p.id === id)!
      expect(projectSegment(besar, profile).tasksPerDay).toBeCloseTo(bySegment(id).tasksPerDay, 5)
    }
  })

  /** Pada config yang berjalan sekarang, tangki 3 energi terlalu kecil untuk SEMUA segmen —
   * bahkan grinder yang kembali tiap 5,7 jam sudah menunggu lebih lama daripada waktu yang
   * dibutuhkan tangkinya terisi penuh. Itu sebabnya `maxEnergy` jadi satu-satunya field yang
   * menaikkan setiap segmen sekaligus. */
  it('tangki energi jadi pengungkit yang sama untuk grinder yang tidak menonton iklan', () => {
    const hemat = { ...BEHAVIOR_PROFILES[4], adsPerDay: 0 }
    expect(projectSegment(LIVE, hemat).bottleneck).toBe('tangki energi')
  })

  /** Begitu tangkinya cukup besar, barulah laju regen yang menggantikan jadi pengikat. Test ini
   * menjaga supaya panel tetap menunjuk field yang berbeda setelah tangkinya dibereskan. */
  it('berpindah menunjuk regen setelah tangkinya cukup besar', () => {
    const tangkiBesar: EconomyConfig = { ...LIVE, maxEnergy: 10 }
    const hemat = { ...BEHAVIOR_PROFILES[4], adsPerDay: 0 }
    expect(projectSegment(tangkiBesar, hemat).bottleneck).toBe('regen energi')
  })
})

describe('PROJ-4 agregat', () => {
  it('menimbang segmen memakai porsi populasinya', () => {
    const { averageRupiahPerDay, segments } = projectEconomy(LIVE)
    const tertinggi = Math.max(...segments.map((s) => s.rupiahPerDay))
    const terendah = Math.min(...segments.map((s) => s.rupiahPerDay))
    expect(averageRupiahPerDay).toBeGreaterThan(terendah)
    expect(averageRupiahPerDay).toBeLessThan(tertinggi)
  })

  /** Rata-rata tertimbang harus mendarat di sekitar Rp 8.841 — rata-rata akrual nyata 4 Sep. */
  it('mendekati rata-rata akrual produksi', () => {
    expect(projectEconomy(LIVE).averageRupiahPerDay).toBeGreaterThan(6_000)
    expect(projectEconomy(LIVE).averageRupiahPerDay).toBeLessThan(12_000)
  })

  it('plafon pemakai maksimum jauh di atas rata-rata, itu angka untuk bot bukan untuk user', () => {
    const { averageRupiahPerDay, maxRupiahPerDay } = projectEconomy(LIVE)
    expect(maxRupiahPerDay).toBeGreaterThan(averageRupiahPerDay * 3)
  })

  it('porsi segmen menutup seluruh populasi', () => {
    const total = BEHAVIOR_PROFILES.reduce((sum, p) => sum + p.shareOfUsers, 0)
    expect(total).toBeCloseTo(1, 2)
  })
})

describe('PROJ-5 penjagaan angka', () => {
  it('menghitung kolam per hari dari config yang dikirim, bukan yang aktif', () => {
    expect(poolCreditsPerDay(LIVE)).toBe(7_200)
    expect(poolCreditsPerDay({ ...LIVE, rewardPoolRegenMinutes: 60, rewardPoolRegenCredits: 1 })).toBe(24)
  })

  it('tidak membagi nol saat reward disetel serendah mungkin', () => {
    const minimum: EconomyConfig = {
      ...LIVE,
      rewardEasy1: 1, rewardEasy2: 1, rewardEasy3: 1,
      rewardMedium1: 1, rewardMedium2: 1, rewardMedium3: 1,
      rewardHard1: 1, rewardHard2: 1, rewardHard3: 1,
    }
    expect(averageReward(minimum)).toBe(1)
    expect(projectSegment(minimum, BEHAVIOR_PROFILES[0]).tasksPerDay).toBeGreaterThan(0)
  })

  it('menjepit profil yang meminta lebih dari yang config izinkan', () => {
    const rakus: BehaviorProfile = {
      ...BEHAVIOR_PROFILES[4], adsPerDay: 9_999, arcadePlaysPerDay: 9_999,
    }
    const s = projectSegment(LIVE, rakus)
    expect(s.source.ads).toBeLessThanOrEqual(LIVE.adsMaxViewsPerDay)
  })
})
