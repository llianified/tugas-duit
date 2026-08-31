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
    id: 'growth',
    label: 'Bakar duit',
    summary:
      'Energi yang jadi pengikat, bukan kolam: ±32 energi gratis/hari lawan kolam ±288 credit yang selalu longgar, jadi user yang mau lanjut harus menonton iklan berhadiah untuk tiket masuk (30/hari, hampir separuh entri). Batas task 400 sebagai jaring anti-bot, plus 4 interstitial per 5 menit. Pantau biaya payout hariannya.',
    values: {
      /**
       * Kapasitas dan laju kolam sengaja dibuat LEBIH BESAR dari yang bisa dihabiskan
       * oleh entri sehari (±62 entri × ±4 credit ≈ 250 credit lawan 288 isi ulang),
       * supaya kolam berhenti menjadi dinding. Ini yang membuat tiket iklan layak
       * ditonton: kalau kolam yang kering lebih dulu, tiket hasil menonton iklan
       * menukar satu entri menjadi task berbayar 0 dan user berhenti menonton.
       *
       * Konsekuensinya harus disadari: begitu energi yang mengikat, biaya payout tidak
       * lagi dibatasi kolam melainkan oleh (energi gratis + tiket iklan) × reward
       * rata-rata. Kolam tinggal berfungsi sebagai plafon pengaman.
       */
      rewardPoolCapIdr: 30_000,
      rewardPoolRegenMinutes: 5,
      rewardPoolRegenCredits: 1,
      rankPoolCapBonus: 10,
      streakCapStepDays: 5,
      maxStreakCapBonus: 20,

      /**
       * Batas task harian dinaikkan supaya yang mengikat payout tetap kolam. Pada
       * ±288 credit/hari dan soal Mudah 3★ yang cuma 3 credit, batas 100 task akan
       * kehabisan kuota sebelum kolamnya habis: user disuruh berhenti padahal masih
       * ada reward, dan sebagian task terakhirnya dibayar 0.
       */
      maxTasksPerDay: 400,

      /**
       * Energi dibuat SENGAJA habis lebih dulu daripada kolam: 5 stok + regen 45 menit
       * = ±32 entri gratis/hari, sementara kolam sehari menyanggupi ±70 task. Sisanya
       * hanya bisa dibuka dengan tiket iklan berhadiah, dan itulah pendorong impresinya.
       *
       * Stok dibatasi 5 supaya energi benar-benar mentok di tengah sesi — stok besar
       * membuat user selesai sebelum bertemu dinding, dan dinding itu yang menjual
       * tontonan iklan. Regen 45 menit juga menahan energi terbuang saat ia pergi.
       */
      maxEnergy: 5,
      energyRegenMinutes: 45,
      energyCostPerTask: 1,

      /**
       * Nilai premium di sini bukan lagi tambahan credit (kolam sudah longgar untuk
       * semua), melainkan bebas iklan: 10 stok + regen 20 menit = ±80 entri gratis,
       * cukup untuk menghabiskan kolamnya tanpa menonton satu tiket pun.
       */
      premiumMaxEnergy: 10,
      premiumEnergyRegenMinutes: 20,

      /**
       * Sisi impresi. Tiket berhadiah kini membayar hampir separuh entri harian, jadi
       * kuotanya dinaikkan ke 30 dan jeda dipendekkan ke 40 detik supaya kuota itu
       * benar-benar habis dipakai, bukan tertahan cooldown. Tiket menambah tontonan
       * tanpa menambah credit — ia menukar ongkos masuk, bukan reward.
       *
       * Interstitial 4 per jendela 5 menit; jadwalnya masih muat: 10s + 3 × 30s = 100s.
       */
      adsMaxViewsPerDay: 30,
      adsCooldownSeconds: 40,
      adsTicketTtlSeconds: 300,
      adsPassTtlMinutes: 10,
      inAppAdsFrequency: 4,
      inAppAdsCappingMinutes: 5,
      inAppAdsIntervalSeconds: 30,
      inAppAdsTimeoutSeconds: 10,

      /**
       * Minimum penarikan dibiarkan tinggi justru karena kolamnya cepat: ambang
       * Rp50.000 tercapai dalam ±2 hari menggiling, jadi ia menahan biaya transfer
       * tanpa memperlambat siapa pun. Gerbang waktunya tetap syarat 7 hari aktif yang
       * hard-coded, yang tidak bisa dipercepat dengan menggenjot task.
       */
      withdrawalMinimumIdr: 50_000,
      withdrawalMinActiveReferrals: 5,
      maxPayoutIdr: 2_000_000_000,

      referralCommissionPercent: 10,
      dailyCommissionCapIdr: 10_000,

      /**
       * Premium diberi perk yang masih terasa di setelan seboros ini — kapasitas kolam
       * +50 dan batas task 800, karena energi saja sudah tidak mengikat. Harga tidak
       * digeser: pada laju kolam ini satu bulan premium tetap lebih murah daripada
       * yang ditarik user dalam sehari, dan itu memang bagian dari yang dibakar.
       */
      premiumPoolCapBonus: 50,
      premiumMaxTasksPerDay: 800,

      // Gerbang channel dibuka: memblok sesi pertama membuang justru trafik yang
      // sedang dibeli. Bonus join dinaikkan sebagai ganti pengunci.
      channelJoinBonusCredits: 50,
      channelGateEnabled: 0,
    },
  },
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
