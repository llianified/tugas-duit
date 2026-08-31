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
 * Preset adalah PATCH SEBAGIAN, bukan config utuh — kecuali `defaults`.
 *
 * Yang ditulis hanya key yang memang digeser oleh arah tersebut, supaya setelan yang
 * sudah diatur admin (harga premium, ambang rank, tingkat kesulitan soal) tidak
 * diam-diam dikembalikan ke bawaan repo saat ia hanya ingin mengubah arah ekonominya.
 *
 * Karena patch digabung ke config yang SEDANG berlaku, setiap key yang punya pasangan
 * lintas-field ikut ditulis walau nilainya sama dengan bawaan. `maxEnergy` tanpa
 * `premiumMaxEnergy`, misalnya, bisa jatuh ke aturan "kapasitas premium tidak boleh di
 * bawah kapasitas biasa" hanya karena config berjalan sudah pernah diubah — kegagalan
 * yang muncul di form sebagai error yang tidak jelas asalnya.
 *
 * Angka rupiah wajib kelipatan `creditValueIdr` (100 pada bawaan). Preset ini tidak
 * menggeser `creditValueIdr`: mengubah kurs akan mengubah nilai rupiah dari SELURUH
 * saldo yang sudah ada di database, dan itu keputusan yang harus diambil sendiri,
 * bukan menumpang preset.
 */
export const ECONOMY_PRESETS: readonly EconomyPreset[] = [
  {
    id: 'retention',
    label: 'Retensi dulu',
    summary:
      'Kolam ±32 credit/hari (≈Rp3.200), energi 8 dengan regen 40 menit, interstitial ditekan jadi 1 per 8 menit. Gerbang tarik dinaikkan ke Rp30.000 supaya biayanya tertahan tanpa mengurangi yang bisa dikerjakan hari ini.',
    values: {
      // Kolam mengikat payout, bukan batas task harian. Cap 50 credit menampung
      // sekitar satu setengah hari isi ulang, jadi user yang absen sehari masih punya
      // stok saat kembali — itu justru bentuk retensinya.
      rewardPoolCapIdr: 5_000,
      rewardPoolRegenMinutes: 45,
      rewardPoolRegenCredits: 1,
      rankPoolCapBonus: 5,
      streakCapStepDays: 5,
      maxStreakCapBonus: 8,

      // Energi longgar: yang dibatasi tetap kolam, jadi menambah energi hanya
      // mempercepat user sampai ke plafonnya, tidak menambah rupiah yang dibayar.
      maxEnergy: 8,
      energyRegenMinutes: 40,
      energyCostPerTask: 1,
      premiumMaxEnergy: 10,
      premiumEnergyRegenMinutes: 20,

      // Tiket iklan berhadiah diperbanyak (ia membayar ongkos masuk task, bukan
      // credit), sementara interstitial otomatis dijarangkan — iklan yang menyela
      // sendiri adalah alasan paling sering user menutup app.
      adsMaxViewsPerDay: 15,
      adsCooldownSeconds: 90,
      inAppAdsFrequency: 1,
      inAppAdsCappingMinutes: 8,
      inAppAdsIntervalSeconds: 60,
      inAppAdsTimeoutSeconds: 20,

      // Yang diketatkan hanya pintu keluarnya: ±10 hari mengumpulkan sebelum payout
      // pertama, dengan biaya transfer yang tertahan di nominal per pengajuan.
      withdrawalMinimumIdr: 30_000,
      withdrawalMinActiveReferrals: 5,

      // Gerbang channel dibuka: memblok app untuk user yang belum join membuang
      // sesi pertama, sesi yang paling menentukan apakah ia kembali.
      channelJoinBonusCredits: 50,
      channelGateEnabled: 0,
    },
  },
  {
    id: 'sustain',
    label: 'Kas aman',
    summary:
      'Lawan dari "Retensi dulu": kolam ±12 credit/hari (≈Rp1.200), energi 4 dengan regen 90 menit, interstitial 3 per 6 menit, komisi referral 5%. Pakai kalau biaya payout sudah melewati pendapatan iklan.',
    values: {
      rewardPoolCapIdr: 2_000,
      rewardPoolRegenMinutes: 120,
      rewardPoolRegenCredits: 1,
      rankPoolCapBonus: 2,
      streakCapStepDays: 7,
      maxStreakCapBonus: 3,

      maxEnergy: 4,
      energyRegenMinutes: 90,
      energyCostPerTask: 1,
      premiumMaxEnergy: 10,
      premiumEnergyRegenMinutes: 25,

      // Impresi dinaikkan dari dua sisi: tiket lebih banyak dan interstitial lebih
      // rapat. Jadwalnya tetap muat di jendelanya — 10s tunda + 2 × 45s jeda = 100s
      // dalam jendela 6 menit.
      adsMaxViewsPerDay: 20,
      adsCooldownSeconds: 60,
      inAppAdsFrequency: 3,
      inAppAdsCappingMinutes: 6,
      inAppAdsIntervalSeconds: 45,
      inAppAdsTimeoutSeconds: 10,

      withdrawalMinimumIdr: 25_000,
      withdrawalMinActiveReferrals: 5,
      referralCommissionPercent: 5,
      dailyCommissionCapIdr: 2_000,

      channelJoinBonusCredits: 10,
      channelGateEnabled: 1,
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
