/** Proyeksi ekonomi: berapa yang user dapat per hari pada satu config, dipisah per segmen perilaku.
 *
 * Ada supaya menyetel ekonomi berhenti jadi tebakan. Panel admin memakainya untuk menghitung ulang
 * akibat sebuah field **sebelum** disimpan, jadi angkanya harus datang dari config yang dikirim
 * pemanggil — bukan `economyConfig()` yang aktif. Itu satu-satunya alasan seluruh modul ini
 * menerima `config` sebagai parameter alih-alih membacanya sendiri.
 *
 * Model dan seluruh konstantanya dikalibrasi dari produksi (4 Sep 2026, 692 user aktif, 11.200 task),
 * bukan dikarang. Yang membuatnya bisa dipercaya cuma satu hal: ia mereproduksi jumlah task tiap
 * segmen pada config yang benar-benar berjalan saat data itu diambil — dikunci di
 * `economy-projection.test.ts`. Mengubah rumusnya tanpa memeriksa test itu berarti menghapus
 * satu-satunya bukti bahwa angkanya berarti.
 */

import type { EconomyConfig } from './economy-config.ts'
import type { Difficulty } from '../task/challenge.ts'
import type { StarCount } from '../progression/stars.ts'

/** Sebaran bintang nyata per kesulitan, dari 11.200 task pada 4 Sep 2026.
 *
 * Dipisah per kesulitan, bukan satu angka global, karena selisihnya menggeser reward rata-rata:
 * Sulit justru paling sering 3★ (78%) meski bayarannya paling besar, sedangkan Mudah paling jarang
 * (66%). Penyebabnya par time yang tidak sebanding dengan waktu pengerjaan sebenarnya — median
 * Mudah 6,9 detik pada par 9 detik, median Sulit 11,6 detik pada par 23 detik. */
const STAR_SHARE: Record<Difficulty, Record<StarCount, number>> = {
  Easy: { 3: 0.6606, 2: 0.2005, 1: 0.1389 },
  Medium: { 3: 0.7575, 2: 0.1353, 1: 0.1072 },
  Hard: { 3: 0.7787, 2: 0.1408, 1: 0.0805 },
}

/** Kesulitan dibagikan `pickOne` yang seragam, jadi tiap tingkat muncul sepertiga.
 * Terkonfirmasi di produksi: 33% / 34% / 33%. */
const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Medium', 'Hard']

/** Detik per task yang benar-benar terpakai user, termasuk jeda membaca soal dan menekan Mulai.
 * Median pengerjaan murni 8,6 detik; sisanya ongkos berpindah antar task. */
const SECONDS_PER_TASK = 22

/** Detik per ronde Arena, dari `arcadeMatchSeconds` bawaan ditambah ongkos membuka dan menutup. */
const SECONDS_PER_ARCADE_PLAY = 45

/** Porsi tiket iklan yang benar-benar berakhir jadi pass terpakai. Sisanya hangus sebelum diklaim
 * — 18% pada 4 Sep (1.048 `expired` dari 5.806 tiket). Tanpa faktor ini proyeksi grinder meleset
 * ke atas sekitar sepuluh task, karena "iklan ditonton" bukan "task yang jadi". */
const AD_TICKET_CONVERSION = 0.82

/** Satu profil perilaku: seberapa jauh user mau melangkah, bukan apa yang config izinkan.
 * Config menentukan langit-langit, profil menentukan sampai mana user benar-benar naik. */
export interface BehaviorProfile {
  id: string
  label: string
  /** Berapa kali user membuka app dalam sehari. Ini yang menentukan berapa energi sempat terkumpul
   * di antara kunjungan, dan karena itu penggerak terbesar segmen kasual. */
  sessionsPerDay: number
  /** Tiket iklan berhadiah yang benar-benar ditonton. Dijepit plafon harian config. */
  adsPerDay: number
  /** Ronde Arena yang dibuka. Dijepit jatah harian config. */
  arcadePlaysPerDay: number
  /** Porsi misi harian yang diklaim, 0..1. */
  missionClaimRate: number
  /** Porsi segmen ini pada populasi terukur, untuk menimbang total. */
  shareOfUsers: number
}

/** Lima segmen, dikalibrasi dari kuartil task pada 4 Sep 2026. Angka `sessionsPerDay` dan
 * `adsPerDay` dipilih supaya proyeksinya jatuh di median task tiap kuartil pada config yang
 * berjalan hari itu — 3, 7, 12, 26, dan 59 task.
 *
 * Yang paling penting dibaca dari daftar ini: tiga segmen teratas, 75% dari user, memakai NOL
 * tiket iklan, NOL ronde Arena, dan NOL misi. Mereka berhenti karena energi habis, bukan karena
 * menabrak plafon apa pun. */
export const BEHAVIOR_PROFILES: readonly BehaviorProfile[] = [
  { id: 'nyoba', label: 'Nyoba doang', sessionsPerDay: 1, adsPerDay: 0, arcadePlaysPerDay: 0, missionClaimRate: 0, shareOfUsers: 0.2732 },
  { id: 'kasual', label: 'Kasual', sessionsPerDay: 2.3, adsPerDay: 0, arcadePlaysPerDay: 0, missionClaimRate: 0, shareOfUsers: 0.2514 },
  { id: 'kasual-rajin', label: 'Kasual rajin', sessionsPerDay: 4, adsPerDay: 0, arcadePlaysPerDay: 0, missionClaimRate: 0, shareOfUsers: 0.2269 },
  { id: 'rajin', label: 'Rajin', sessionsPerDay: 4, adsPerDay: 13, arcadePlaysPerDay: 1, missionClaimRate: 0.43, shareOfUsers: 0.1445 },
  /** `adsPerDay` di atas plafon config: grinder mau menonton sebanyak yang diizinkan, jadi yang
   * menentukan angkanya adalah `adsMaxViewsPerDay`, bukan profilnya. Observasi 49 tayangan pada
   * plafon 50 memang sudah bentuk terjepit, bukan selera. */
  { id: 'grinder', label: 'Grinder', sessionsPerDay: 4.2, adsPerDay: 999, arcadePlaysPerDay: 1, missionClaimRate: 0.86, shareOfUsers: 0.104 },
]

/** Apa yang benar-benar menghentikan user. Dipakai panel untuk menunjuk field mana yang perlu
 * digeser — menaikkan kolam tidak menambah satu task pun untuk user yang tertahan energi.
 *
 * Tangki dan regen dipisah karena obatnya berbeda dan salah pilih berarti membakar uang tanpa
 * menambah satu sesi pun. User yang datang 2x sehari sudah menunggu 10 jam di antara kunjungan:
 * regen 100 menit sudah sempat mengisi 6 energi, tapi tangkinya cuma muat 3, jadi tiga sisanya
 * tidak pernah ada. Mempercepat regen untuk orang ini tidak mengubah apa pun; yang mengubah cuma
 * `maxEnergy`. Kebalikannya berlaku untuk grinder yang datang tiap 5 jam. */
export type Bottleneck = 'tangki energi' | 'regen energi' | 'iklan' | 'plafon harian' | 'stok reward'

export interface SegmentProjection {
  profile: BehaviorProfile
  /** Task yang benar-benar dibayar. */
  tasksPerDay: number
  creditsPerDay: number
  rupiahPerDay: number
  /** Menit aktif di app, di luar waktu menunggu cooldown. */
  activeMinutesPerDay: number
  bottleneck: Bottleneck
  /** Rincian asal kesempatan task, untuk ditampilkan apa adanya di panel. */
  source: { energy: number; ads: number; missions: number; arcade: number }
  /** Hari sampai ambang penarikan pertama tercapai, `null` kalau tidak pernah. */
  daysToWithdrawal: number | null
}

/** Reward rata-rata satu task pada config tertentu, ditimbang sebaran bintang nyata. */
export function averageReward(config: EconomyConfig): number {
  const reward = (d: Difficulty, s: StarCount) =>
    d === 'Easy'
      ? s === 1 ? config.rewardEasy1 : s === 2 ? config.rewardEasy2 : config.rewardEasy3
      : d === 'Medium'
        ? s === 1 ? config.rewardMedium1 : s === 2 ? config.rewardMedium2 : config.rewardMedium3
        : s === 1 ? config.rewardHard1 : s === 2 ? config.rewardHard2 : config.rewardHard3

  const perDifficulty = DIFFICULTIES.map((d) =>
    ([1, 2, 3] as StarCount[]).reduce((sum, s) => sum + STAR_SHARE[d][s] * reward(d, s), 0),
  )
  return perDifficulty.reduce((a, b) => a + b, 0) / DIFFICULTIES.length
}

/** Credit yang masuk kolam dalam 24 jam. Kembaran `rewardPoolCreditsPerDay` di `reward-pool.ts`,
 * dipisah karena yang ini harus bisa menghitung config yang belum aktif. */
export function poolCreditsPerDay(config: EconomyConfig): number {
  return (1_440 / config.rewardPoolRegenMinutes) * config.rewardPoolRegenCredits
}

/** Energi harian dari misi yang benar-benar diklaim. Misi sekali-seumur-akun (follow, like & repost)
 * sengaja tidak ikut: ia tidak berulang, jadi memasukkannya akan menggelembungkan proyeksi harian. */
function missionEnergy(config: EconomyConfig, claimRate: number): number {
  const daily =
    config.missionTasksReward +
    config.missionStarsReward +
    (config.adsMaxViewsPerDay > 0 ? config.missionAdsReward : 0) +
    config.missionTwitterPostReward +
    config.missionFacebookPostReward
  return daily * Math.max(0, Math.min(1, claimRate))
}

/** Energi yang sempat terkumpul di antara dua kunjungan, dijepit kapasitas tangki.
 *
 * Di sinilah `energyRegenMinutes` menggigit, dan ia menggigit paling keras untuk user yang jarang
 * membuka app — bukan untuk grinder. User yang datang 3x sehari dengan tangki 3 dan regen 100 menit
 * mendapat 3 energi tiap kunjungan (jeda 8 jam sudah lebih dari cukup), jadi ia terkunci di 9 task
 * berapa pun besar kolamnya. Yang menaikkan angkanya cuma tangki yang lebih besar. */
function energyPerSession(config: EconomyConfig, sessionsPerDay: number): number {
  const gapMinutes = 1_440 / Math.max(0.01, sessionsPerDay)
  return Math.min(config.maxEnergy, gapMinutes / config.energyRegenMinutes)
}

interface Computed {
  tasksPerDay: number
  creditsPerDay: number
  source: { energy: number; ads: number; missions: number; arcade: number }
  arcadePlays: number
}

function compute(config: EconomyConfig, profile: BehaviorProfile): Computed {
  const cost = Math.max(1, config.energyCostPerTask)

  const arcadePlays = Math.min(profile.arcadePlaysPerDay, config.arcadeMaxPlaysPerDay)
  const weights = config.arcadePoolPrizeWeight + config.arcadeEnergyPrizeWeight + config.arcadeBlankWeight
  const arcadeEnergy = weights > 0
    ? arcadePlays * (config.arcadeEnergyPrizeWeight / weights) * config.arcadeEnergyPrizeAmount
    : 0
  /** Arena mengisi kolam, jadi ia menaikkan plafon — tapi tidak pernah melebihi daya tampung
   * tangki, karena `applyRewardPoolRefund` menjepit di kapasitas dan `eligiblePrizes` mencoret
   * hadiah yang tidak muat. */
  const tank = config.rewardPoolCapIdr / config.creditValueIdr
  const arcadeRefill = weights > 0
    ? Math.min(arcadePlays * (config.arcadePoolPrizeWeight / weights) * config.arcadePoolPrizeCredits, tank)
    : 0

  /** Ronde Arena yang dikunci iklan memakan tiket dari plafon yang sama dengan task. */
  const adBudget = Math.min(profile.adsPerDay, config.adsMaxViewsPerDay)
  const ticketsForTasks = Math.max(0, adBudget - (config.arcadeAdGated > 0 ? arcadePlays : 0))

  const source = {
    energy: (profile.sessionsPerDay * energyPerSession(config, profile.sessionsPerDay)) / cost,
    ads: ticketsForTasks * AD_TICKET_CONVERSION,
    missions: missionEnergy(config, profile.missionClaimRate) / cost,
    arcade: arcadeEnergy / cost,
  }
  const opportunities = source.energy + source.ads + source.missions + source.arcade

  const ceiling = poolCreditsPerDay(config) + arcadeRefill
  const reward = averageReward(config)
  const creditsPerDay = Math.min(Math.min(opportunities, config.maxTasksPerDay) * reward, ceiling)

  return {
    tasksPerDay: reward > 0 ? creditsPerDay / reward : 0,
    creditsPerDay,
    source,
    arcadePlays,
  }
}

/** Field mana yang, kalau digeser satu langkah, benar-benar menambah paling banyak task untuk
 * segmen ini.
 *
 * Dihitung dengan mencoba, bukan diurutkan dengan tebakan. Bentuk lamanya adalah rantai `if` yang
 * memakai urutan prioritas, dan itu menjawab salah untuk kasus yang paling penting: user kasual
 * yang tangkinya penuh terbaca "tertahan regen", padahal mempercepat regen tidak menambah satu
 * task pun untuknya. Mencoba setiap pengungkit lalu mengambil yang paling besar hasilnya membuat
 * jawabannya selalu benar menurut definisi yang dipakai panel: **naikkan yang ini kalau mau
 * segmen ini main lebih banyak**.
 *
 * Langkah tiap pengungkit sengaja sebesar yang wajar ditekan admin sekali klik, bukan epsilon —
 * pengungkit dengan efek tangga (tangki energi, plafon harian) tidak bergerak sama sekali pada
 * perubahan yang terlalu kecil. */
function findBottleneck(config: EconomyConfig, profile: BehaviorProfile, base: Computed): Bottleneck {
  const candidates: [Bottleneck, EconomyConfig][] = [
    ['tangki energi', { ...config, maxEnergy: config.maxEnergy + 2 }],
    ['regen energi', { ...config, energyRegenMinutes: Math.max(1, Math.round(config.energyRegenMinutes / 2)) }],
    ['iklan', { ...config, adsMaxViewsPerDay: config.adsMaxViewsPerDay + 10 }],
    ['plafon harian', { ...config, maxTasksPerDay: config.maxTasksPerDay + 20 }],
    ['stok reward', { ...config, rewardPoolRegenCredits: config.rewardPoolRegenCredits * 2 }],
  ]

  let best: Bottleneck = 'tangki energi'
  let bestGain = -1
  for (const [name, bumped] of candidates) {
    const gain = compute(bumped, profile).tasksPerDay - base.tasksPerDay
    if (gain > bestGain) {
      bestGain = gain
      best = name
    }
  }
  return best
}

export function projectSegment(config: EconomyConfig, profile: BehaviorProfile): SegmentProjection {
  const base = compute(config, profile)
  const rupiahPerDay = base.creditsPerDay * config.creditValueIdr
  const minimumCredits = config.withdrawalMinimumIdr / config.creditValueIdr

  return {
    profile,
    tasksPerDay: base.tasksPerDay,
    creditsPerDay: base.creditsPerDay,
    rupiahPerDay,
    activeMinutesPerDay:
      (base.tasksPerDay * SECONDS_PER_TASK + base.arcadePlays * SECONDS_PER_ARCADE_PLAY) / 60,
    bottleneck: findBottleneck(config, profile, base),
    source: base.source,
    daysToWithdrawal: base.creditsPerDay > 0 ? Math.ceil(minimumCredits / base.creditsPerDay) : null,
  }
}

export interface EconomyProjection {
  segments: SegmentProjection[]
  /** Rata-rata tertimbang porsi segmen — angka yang dikalikan jumlah user aktif. */
  averageRupiahPerDay: number
  averageTasksPerDay: number
  averageActiveMinutes: number
  /** Plafon per akun kalau seseorang memakai SETIAP jatah yang config izinkan. Ini angka yang
   * relevan untuk bot farm, bukan untuk user biasa. */
  maxRupiahPerDay: number
}

export function projectEconomy(
  config: EconomyConfig,
  profiles: readonly BehaviorProfile[] = BEHAVIOR_PROFILES,
): EconomyProjection {
  const segments = profiles.map((p) => projectSegment(config, p))
  const weight = segments.reduce((sum, s) => sum + s.profile.shareOfUsers, 0) || 1
  const weighted = (pick: (s: SegmentProjection) => number) =>
    segments.reduce((sum, s) => sum + pick(s) * s.profile.shareOfUsers, 0) / weight

  /** Pemakai maksimum: membuka app tiap kali energi genap, menghabiskan seluruh plafon iklan,
   * dan mengambil semua jatah Arena serta misi. */
  const maxProfile: BehaviorProfile = {
    id: 'maks', label: 'Pemakai maksimum',
    sessionsPerDay: Math.max(1, 1_440 / (config.energyRegenMinutes * Math.max(1, config.maxEnergy))),
    adsPerDay: config.adsMaxViewsPerDay,
    arcadePlaysPerDay: config.arcadeMaxPlaysPerDay,
    missionClaimRate: 1,
    shareOfUsers: 0,
  }

  return {
    segments,
    averageRupiahPerDay: weighted((s) => s.rupiahPerDay),
    averageTasksPerDay: weighted((s) => s.tasksPerDay),
    averageActiveMinutes: weighted((s) => s.activeMinutesPerDay),
    maxRupiahPerDay: projectSegment(config, maxProfile).rupiahPerDay,
  }
}
