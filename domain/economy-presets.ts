import {
  DEFAULT_ECONOMY_CONFIG,
  ECONOMY_FIELDS,
  type EconomyConfig,
  type EconomyConfigKey,
} from '@/domain/economy-config'

export interface EconomyPreset {
  id: string
  label: string
  summary: string
  values: Partial<EconomyConfig>
}

const KEYS = new Set<string>(ECONOMY_FIELDS.map((field) => field.key))

/**
 * Preset "Sesi pendek, sering kembali": disetel untuk model pendapatan impresi
 * iklan in-app, bukan sesi panjang.
 *
 * Tiga angka dikunci dari luar dan tidak disentuh preset ini: 1 credit = Rp 100,
 * tabel reward per bintang, dan minimum penarikan Rp 10.000 + 3 referral aktif.
 * Konsekuensinya aritmetiknya keras: reward rata-rata ~4 credit/task, jadi
 * plafon Rp 10.000/hari = 100 credit = hanya ~25 task BERBAYAR per hari. Itu
 * langit-langit yang tidak bisa dinegosiasi tanpa mengubah salah satu dari tiga
 * angka di atas.
 *
 * Cara 25 task itu disebar jadi banyak app-open:
 *   - Kolam kecil (Rp 2.000 = 20 credit, ~5 task) penuh dalam 5 jam. User yang
 *     mau memanen penuh harus kembali 4–5 kali sehari; kolam yang lebih besar
 *     justru MENGURANGI jumlah app-open.
 *   - Laju 1 credit / 15 menit = 96 credit/hari = Rp 9.600/hari. Itu plafon
 *     sesungguhnya, dan satu-satunya sumber rupiah di app ini.
 *   - Jeda iklan 60 menit (3.600 detik, batas maksimum field) menyebar 10 tiket
 *     ke ~10 jam, bukan habis dalam satu sesi 20 menit seperti pada jeda 120
 *     detik.
 *
 * PENTING — tiket iklan di kode ini hanya membayar ongkos ENERGI satu task, ia
 * tidak menambah credit. Jadi ketika kolam kosong, tiket iklan tidak punya nilai
 * apa pun bagi user, dan prompt iklan di momen itu akan diabaikan. Preset ini
 * menyiapkan angkanya, tapi momen "kolam kosong" baru jadi inventory iklan
 * setelah mode XP/rank tanpa credit dipasang di domain/reward-pool.ts.
 *
 * Energi sengaja TIDAK dijadikan tembok kedua: kapasitasnya 10 (batas keras
 * constraint users_energy_range) dengan regen 15 menit, supaya yang menghentikan
 * sesi selalu kolam reward — satu tembok yang bisa dijelaskan, bukan dua tembok
 * yang jatuh bersamaan seperti pada setelan 5 energi + kolam Rp 5.000.
 */
export const ECONOMY_PRESETS: readonly EconomyPreset[] = [
  {
    id: 'short-session-ads',
    label: 'Saran: sesi pendek, sering kembali',
    summary:
      'Kolam Rp 2.000 (~5 task) penuh dalam 5 jam, isi ulang 1 credit / 15 menit (plafon Rp 9.600/hari). Jeda iklan 60 menit menyebar 10 tiket ke ~10 app-open. Cair Rp 10.000 ~1–2 hari, tetap terkunci 3 referral aktif.',
    values: {
      creditValueIdr: 100,
      rewardPoolCapIdr: 2_000,
      rewardPoolRegenMinutes: 15,
      rewardPoolRegenCredits: 1,
      rankPoolCapBonus: 10,
      streakCapStepDays: 7,
      maxStreakCapBonus: 10,
      maxTasksPerDay: 500,
      maxAttemptsPerTask: 3,
      taskWindowSeconds: 300,
      star2ParMultiplier: 2,
      textLengthEasy: 4,
      textLengthMedium: 6,
      textLengthHard: 8,
      mathDigitsEasy: 2,
      mathDigitsMedium: 2,
      mathDigitsHard: 3,
      mathCeilingEasy: 30,
      mathCeilingMedium: 99,
      mathCeilingHard: 400,
      selectOptionsEasy: 4,
      selectOptionsMedium: 6,
      selectOptionsHard: 9,
      parTimeEasyMs: 10_000,
      parTimeMediumMs: 18_000,
      parTimeHardMs: 28_000,
      rewardEasy1: 1,
      rewardEasy2: 2,
      rewardEasy3: 3,
      rewardMedium1: 2,
      rewardMedium2: 4,
      rewardMedium3: 6,
      rewardHard1: 3,
      rewardHard2: 6,
      rewardHard3: 9,
      maxEnergy: 10,
      energyRegenMinutes: 15,
      energyCostPerTask: 1,
      adsMaxViewsPerDay: 10,
      adsCooldownSeconds: 3_600,
      adsTicketTtlSeconds: 300,
      adsPassTtlMinutes: 30,
      withdrawalMinimumIdr: 10_000,
      withdrawalMinActiveReferrals: 3,
      maxPayoutIdr: 500_000,
      referralCommissionPercent: 10,
      dailyCommissionCapIdr: 1_000,
      rankTier2Tasks: 50,
      rankTier3Tasks: 150,
      rankTier4Tasks: 400,
      rankTier5Tasks: 1_000,
      channelJoinBonusCredits: 10,
      premiumPrice1Idr: 19_900,
      premiumPrice2Idr: 34_900,
      premiumPrice3Idr: 44_900,
      // Premium dijual sebagai kenyamanan, bukan penghasilan lebih besar: laju
      // isi ulang kolam tidak ikut naik, jadi plafon rupiah per harinya sama
      // dengan user biasa. Yang dibeli adalah kolam 70 credit (tidak perlu login
      // tiap 5 jam untuk memanen penuh) dan energi yang tidak pernah terasa.
      premiumMaxEnergy: 10,
      premiumEnergyRegenMinutes: 5,
      premiumPoolCapBonus: 50,
      premiumMaxTasksPerDay: 1_000,
      premiumWithdrawalCooldownDays: 3,
    },
  },
  {
    id: 'defaults',
    label: 'Nilai bawaan kode',
    summary: 'Kembalikan seluruh setelan ke DEFAULT_ECONOMY_CONFIG yang ada di repo.',
    values: DEFAULT_ECONOMY_CONFIG,
  },
]

export type EconomyPatch = Partial<Record<EconomyConfigKey, number>>

export type EconomyPatchResult =
  | { ok: true; patch: EconomyPatch; unknownKeys: string[] }
  | { ok: false; message: string }

/** Menerima JSON penuh maupun sebagian, termasuk hasil "Salin config" yang dibungkus { config: … }. */
export function parseEconomyPatch(text: string): EconomyPatchResult {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, message: 'Tempel dulu JSON konfigurasinya.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, message: 'JSON tidak bisa dibaca. Pastikan tersalin utuh, termasuk kurung kurawalnya.' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'Isinya harus objek JSON, bukan angka atau daftar.' }
  }

  const record = parsed as Record<string, unknown>
  const source =
    record.config && typeof record.config === 'object' && !Array.isArray(record.config)
      ? (record.config as Record<string, unknown>)
      : record

  const patch: EconomyPatch = {}
  const unknownKeys: string[] = []
  const badKeys: string[] = []

  for (const [key, value] of Object.entries(source)) {
    if (!KEYS.has(key)) {
      unknownKeys.push(key)
      continue
    }
    const numeric = typeof value === 'string' ? Number(value.trim()) : value
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
      badKeys.push(key)
      continue
    }
    patch[key as EconomyConfigKey] = numeric
  }

  if (badKeys.length > 0) {
    return { ok: false, message: `Nilai bukan angka pada: ${badKeys.slice(0, 4).join(', ')}.` }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: 'Tidak ada satu pun key setelan yang dikenali di JSON itu.' }
  }

  return { ok: true, patch, unknownKeys }
}
