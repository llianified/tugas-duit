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
 * Preset "Kolam besar, laju tetap": kolam reward diperbesar supaya user yang
 * hanya sempat 1–2 sesi per hari tidak kehilangan isi ulang karena kolam penuh,
 * sementara laju isi ulang tetap yang menentukan plafon harian (Rp 24.000/hari).
 * Dengan minimum penarikan Rp 50.000: bot 24 jam ~2 hari, grinder 8 jam ~5 hari,
 * user aktif normal ~10 hari, user santai ~3 minggu.
 */
export const ECONOMY_PRESETS: readonly EconomyPreset[] = [
  {
    id: 'balanced-pool',
    label: 'Saran: kolam besar, laju tetap',
    summary:
      'Kolam Rp 10.000 penuh dalam 10 jam, isi ulang 1 credit / 6 menit (plafon Rp 24.000/hari). Grinder cair ~5 hari, santai ~3 minggu.',
    values: {
      creditValueIdr: 100,
      rewardPoolCapIdr: 10_000,
      rewardPoolRegenMinutes: 6,
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
      maxEnergy: 5,
      energyRegenMinutes: 10,
      energyCostPerTask: 1,
      adsMaxViewsPerDay: 10,
      adsCooldownSeconds: 120,
      adsTicketTtlSeconds: 300,
      adsPassTtlMinutes: 30,
      withdrawalMinimumIdr: 50_000,
      maxPayoutIdr: 5_000_000,
      referralCommissionPercent: 10,
      dailyCommissionCapIdr: 5_000,
      rankTier2Tasks: 50,
      rankTier3Tasks: 150,
      rankTier4Tasks: 400,
      rankTier5Tasks: 1_000,
      channelJoinBonusCredits: 25,
      premiumPrice1Idr: 19_900,
      premiumPrice2Idr: 34_900,
      premiumPrice3Idr: 44_900,
      premiumMaxEnergy: 10,
      premiumEnergyRegenMinutes: 5,
      premiumPoolCapBonus: 60,
      premiumMaxTasksPerDay: 800,
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
