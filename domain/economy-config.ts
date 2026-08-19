
import type { Difficulty } from '@/features/captcha/domain'
import type { StarCount } from '@/domain/stars'

export interface EconomyConfig {
  creditValueIdr: number
  rewardPoolCapIdr: number
  rewardPoolRegenMinutes: number
  rewardPoolRegenCredits: number
  rankPoolCapBonus: number
  streakCapStepDays: number
  maxStreakCapBonus: number
  maxTasksPerDay: number
  maxAttemptsPerTask: number
  taskWindowSeconds: number
  star2ParMultiplier: number
  textLengthEasy: number
  textLengthMedium: number
  textLengthHard: number
  mathDigitsEasy: number
  mathDigitsMedium: number
  mathDigitsHard: number
  mathCeilingEasy: number
  mathCeilingMedium: number
  mathCeilingHard: number
  selectOptionsEasy: number
  selectOptionsMedium: number
  selectOptionsHard: number
  parTimeEasyMs: number
  parTimeMediumMs: number
  parTimeHardMs: number
  rewardEasy1: number
  rewardEasy2: number
  rewardEasy3: number
  rewardMedium1: number
  rewardMedium2: number
  rewardMedium3: number
  rewardHard1: number
  rewardHard2: number
  rewardHard3: number
  maxEnergy: number
  energyRegenMinutes: number
  energyCostPerTask: number
  withdrawalMinimumIdr: number
  maxPayoutIdr: number
  referralCommissionPercent: number
  dailyCommissionCapIdr: number
  rankTier2Tasks: number
  rankTier3Tasks: number
  rankTier4Tasks: number
  rankTier5Tasks: number
}

export type EconomyConfigKey = keyof EconomyConfig

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  creditValueIdr: 100,
  rewardPoolCapIdr: 3_000,
  rewardPoolRegenMinutes: 48,
  rewardPoolRegenCredits: 1,
  rankPoolCapBonus: 3,
  streakCapStepDays: 7,
  maxStreakCapBonus: 4,
  maxTasksPerDay: 300,
  maxAttemptsPerTask: 3,
  taskWindowSeconds: 300,
  star2ParMultiplier: 2,
  textLengthEasy: 4,
  textLengthMedium: 5,
  textLengthHard: 6,
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
  rewardMedium2: 3,
  rewardMedium3: 5,
  rewardHard1: 3,
  rewardHard2: 6,
  rewardHard3: 9,
  maxEnergy: 5,
  energyRegenMinutes: 60,
  energyCostPerTask: 1,
  withdrawalMinimumIdr: 10_000,
  maxPayoutIdr: 2_000_000_000,
  referralCommissionPercent: 10,
  dailyCommissionCapIdr: 6_000,
  rankTier2Tasks: 100,
  rankTier3Tasks: 300,
  rankTier4Tasks: 700,
  rankTier5Tasks: 1_500,
}

export type EconomyGroup =
  | 'earnings'
  | 'reward'
  | 'task'
  | 'difficulty'
  | 'energy'
  | 'withdrawal'
  | 'referral'
  | 'progression'

export interface EconomyFieldMeta {
  key: EconomyConfigKey
  group: EconomyGroup
  label: string
  unit: string
  description: string
  impact: string
  min: number
  max: number
  riskyWhen: 'higher' | 'lower' | 'never'
}

export const ECONOMY_FIELDS: readonly EconomyFieldMeta[] = [
  {
    key: 'creditValueIdr', group: 'earnings', label: 'Nilai 1 credit', unit: 'Rp',
    description: 'Kurs credit ke Rupiah. Seluruh nominal Rupiah di aplikasi diturunkan dari angka ini.',
    impact: 'Menaikkannya menaikkan nilai rupiah setiap saldo, reward, dan penarikan yang sudah ada.',
    min: 1, max: 10_000, riskyWhen: 'higher',
  },
  {
    key: 'rewardPoolCapIdr', group: 'earnings', label: 'Kapasitas kolam dasar', unit: 'Rp',
    description: 'Isi maksimum kolam reward per user, sebelum bonus rank dan streak. Tidak ada reset harian: kolam terisi kembali sedikit demi sedikit seperti energi.',
    impact: 'Menaikkannya memperbesar reward yang bisa ditumpuk lalu dihabiskan dalam satu sesi.',
    min: 100, max: 1_000_000, riskyWhen: 'higher',
  },
  {
    key: 'rewardPoolRegenMinutes', group: 'earnings', label: 'Interval isi ulang kolam', unit: 'menit',
    description: 'Berapa menit sekali kolam reward bertambah. Menit yang belum genap tidak hangus.',
    impact: 'Menurunkannya mempercepat isi ulang, sehingga penghasilan maksimum per hari naik.',
    min: 1, max: 1_440, riskyWhen: 'lower',
  },
  {
    key: 'rewardPoolRegenCredits', group: 'earnings', label: 'Isi ulang per interval', unit: 'credit',
    description: 'Credit yang masuk ke kolam setiap satu interval isi ulang terlewati.',
    impact: 'Menaikkannya mempercepat isi ulang, sehingga penghasilan maksimum per hari naik.',
    min: 1, max: 100, riskyWhen: 'higher',
  },
  {
    key: 'rankPoolCapBonus', group: 'earnings', label: 'Bonus kapasitas per rank', unit: 'credit',
    description: 'Tambahan kapasitas kolam untuk setiap tingkat rank di atas Apprentice. Menambah daya tampung, bukan kecepatan isi ulang.',
    impact: 'Menaikkannya memperbesar kolam user rank tinggi.',
    min: 0, max: 100, riskyWhen: 'higher',
  },
  {
    key: 'streakCapStepDays', group: 'earnings', label: 'Langkah bonus streak', unit: 'hari',
    description: 'Setiap berapa hari aktif berturut-turut satu bonus kapasitas kolam terbuka.',
    impact: 'Menurunkannya membuat bonus streak terbuka lebih cepat, sehingga kapasitas naik lebih cepat.',
    min: 1, max: 365, riskyWhen: 'lower',
  },
  {
    key: 'maxStreakCapBonus', group: 'earnings', label: 'Maksimum bonus streak', unit: 'credit',
    description: 'Langit-langit bonus kapasitas dari streak, berapa pun panjang rentetannya.',
    impact: 'Menaikkannya memperbesar kolam user dengan streak panjang.',
    min: 0, max: 100, riskyWhen: 'higher',
  },
  {
    key: 'maxTasksPerDay', group: 'earnings', label: 'Batas task harian', unit: 'task',
    description: 'Jaring anti-bot, bukan penjaga ekonomi. Satu-satunya batas yang masih ikut hari kalender WIB.',
    impact: 'Menaikkannya melonggarkan jaring anti-bot; tidak menaikkan payout karena kolam reward tetap mengikat.',
    min: 1, max: 100_000, riskyWhen: 'never',
  },
  {
    key: 'parTimeEasyMs', group: 'reward', label: 'Par time Mudah', unit: 'ms',
    description: 'Durasi acuan 3 bintang untuk task Mudah. Batas 2 bintang adalah dua kali angka ini.',
    impact: 'Menaikkannya membuat 3 bintang lebih mudah dicapai, sehingga reward rata-rata naik.',
    min: 1_000, max: 600_000, riskyWhen: 'higher',
  },
  {
    key: 'parTimeMediumMs', group: 'reward', label: 'Par time Sedang', unit: 'ms',
    description: 'Durasi acuan 3 bintang untuk task Sedang.',
    impact: 'Menaikkannya membuat 3 bintang lebih mudah dicapai, sehingga reward rata-rata naik.',
    min: 1_000, max: 600_000, riskyWhen: 'higher',
  },
  {
    key: 'parTimeHardMs', group: 'reward', label: 'Par time Sulit', unit: 'ms',
    description: 'Durasi acuan 3 bintang untuk task Sulit.',
    impact: 'Menaikkannya membuat 3 bintang lebih mudah dicapai, sehingga reward rata-rata naik.',
    min: 1_000, max: 600_000, riskyWhen: 'higher',
  },
  ...(
    [
      ['rewardEasy1', 'Mudah 1★'], ['rewardEasy2', 'Mudah 2★'], ['rewardEasy3', 'Mudah 3★'],
      ['rewardMedium1', 'Sedang 1★'], ['rewardMedium2', 'Sedang 2★'], ['rewardMedium3', 'Sedang 3★'],
      ['rewardHard1', 'Sulit 1★'], ['rewardHard2', 'Sulit 2★'], ['rewardHard3', 'Sulit 3★'],
    ] as [EconomyConfigKey, string][]
  ).map(([key, label]): EconomyFieldMeta => ({
    key, group: 'reward', label: `Reward ${label}`, unit: 'credit',
    description: 'Credit yang dibayar untuk satu task pada kesulitan dan jumlah bintang tersebut.',
    impact: 'Menaikkannya menaikkan reward per task; kolam reward tetap membatasi totalnya.',
    min: 1, max: 50, riskyWhen: 'higher',
  })),
  {
    key: 'maxAttemptsPerTask', group: 'task', label: 'Percobaan per soal', unit: 'percobaan',
    description: 'Berapa kali user boleh menjawab salah sebelum soalnya hangus. Batas 5 datang dari constraint kolom challenges.attempts.',
    impact: 'Menaikkannya memperbesar peluang satu soal berakhir dibayar, sehingga reward rata-rata per soal naik.',
    min: 1, max: 5, riskyWhen: 'higher',
  },
  {
    key: 'taskWindowSeconds', group: 'task', label: 'Batas waktu pengerjaan', unit: 'detik',
    description: 'Waktu sejak soal dimulai sampai hangus. Soal yang hangus tanpa percobaan mengembalikan energinya.',
    impact: 'Menaikkannya memberi lebih banyak waktu untuk menjawab benar, sehingga lebih sedikit soal berakhir tanpa bayaran.',
    min: 30, max: 3_600, riskyWhen: 'higher',
  },
  {
    key: 'star2ParMultiplier', group: 'task', label: 'Pengali batas 2 bintang', unit: '× par time',
    description: 'Batas 2 bintang adalah par time dikali angka ini. Lebih lambat dari itu jadi 1 bintang.',
    impact: 'Menaikkannya memperlebar jendela 2 bintang, sehingga lebih sedikit pengerjaan jatuh ke 1 bintang.',
    min: 1, max: 10, riskyWhen: 'higher',
  },
  ...(
    [
      ['textLengthEasy', 'Mudah'], ['textLengthMedium', 'Sedang'], ['textLengthHard', 'Sulit'],
    ] as [EconomyConfigKey, string][]
  ).map(([key, label]): EconomyFieldMeta => ({
    key, group: 'difficulty', label: `Panjang teks ${label}`, unit: 'karakter',
    description: `Jumlah karakter yang harus diketik ulang pada soal Ketik Ulang tingkat ${label}.`,
    impact: 'Menurunkannya mempercepat pengerjaan, sehingga lebih banyak yang mencapai 3 bintang.',
    min: 3, max: 10, riskyWhen: 'lower',
  })),
  ...(
    [
      ['mathDigitsEasy', 'Mudah'], ['mathDigitsMedium', 'Sedang'], ['mathDigitsHard', 'Sulit'],
    ] as [EconomyConfigKey, string][]
  ).map(([key, label]): EconomyFieldMeta => ({
    key, group: 'difficulty', label: `Digit jawaban Hitung ${label}`, unit: 'digit',
    description: `Banyak digit hasil pada soal Hitung tingkat ${label}. Menentukan rentang terkecil hasilnya.`,
    impact: 'Menurunkannya membuat hitungannya lebih ringan, sehingga pengerjaan lebih cepat.',
    min: 1, max: 4, riskyWhen: 'lower',
  })),
  ...(
    [
      ['mathCeilingEasy', 'Mudah'], ['mathCeilingMedium', 'Sedang'], ['mathCeilingHard', 'Sulit'],
    ] as [EconomyConfigKey, string][]
  ).map(([key, label]): EconomyFieldMeta => ({
    key, group: 'difficulty', label: `Batas hasil Hitung ${label}`, unit: 'nilai',
    description: `Hasil terbesar yang boleh muncul pada soal Hitung tingkat ${label}. Harus muat untuk jumlah digit di atas.`,
    impact: 'Menurunkannya mengecilkan angka yang dihitung, sehingga pengerjaan lebih cepat.',
    min: 9, max: 9_999, riskyWhen: 'lower',
  })),
  ...(
    [
      ['selectOptionsEasy', 'Mudah'], ['selectOptionsMedium', 'Sedang'], ['selectOptionsHard', 'Sulit'],
    ] as [EconomyConfigKey, string][]
  ).map(([key, label]): EconomyFieldMeta => ({
    key, group: 'difficulty', label: `Pilihan bentuk ${label}`, unit: 'pilihan',
    description: `Banyak bentuk yang ditampilkan pada soal Pilih Bentuk tingkat ${label}. Maksimum 9, sebanyak bentuk yang tersedia.`,
    impact: 'Menurunkannya mempermudah menemukan jawaban, dan memperbesar peluang tebakan asal berhasil.',
    min: 2, max: 9, riskyWhen: 'lower',
  })),
  {
    key: 'maxEnergy', group: 'energy', label: 'Kapasitas energi', unit: 'energi',
    description: 'Stok energi maksimum yang bisa ditampung satu user.',
    impact: 'Menaikkannya memperbanyak task yang bisa dikerjakan sekaligus.',
    min: 1, max: 10, riskyWhen: 'lower',
  },
  {
    key: 'energyRegenMinutes', group: 'energy', label: 'Interval regen energi', unit: 'menit',
    description: 'Berapa menit sekali satu energi terisi kembali. Tidak ada reset harian.',
    impact: 'Menurunkannya mempercepat regen, sehingga user bisa mengerjakan lebih banyak task per hari.',
    min: 1, max: 1_440, riskyWhen: 'lower',
  },
  {
    key: 'energyCostPerTask', group: 'energy', label: 'Biaya energi per task', unit: 'energi',
    description: 'Energi yang dipotong saat memulai satu task.',
    impact: 'Menurunkannya memperbanyak task yang bisa dikerjakan dari stok yang sama.',
    min: 1, max: 10, riskyWhen: 'lower',
  },
  {
    key: 'withdrawalMinimumIdr', group: 'withdrawal', label: 'Minimum penarikan', unit: 'Rp',
    description: 'Nominal terkecil yang bisa diajukan. Menahan biaya transfer per payout.',
    impact: 'Menurunkannya membuat penarikan lebih sering, sehingga biaya transfer per rupiah naik.',
    min: 1_000, max: 10_000_000, riskyWhen: 'lower',
  },
  {
    key: 'maxPayoutIdr', group: 'withdrawal', label: 'Maksimum penarikan', unit: 'Rp/pengajuan',
    description: 'Langit-langit satu pengajuan. Lantai kewarasan, bukan batas harian — saldo membatasi lebih dulu.',
    impact: 'Menaikkannya memperbesar nominal terbesar yang bisa diajukan sekali kirim.',
    min: 10_000, max: 2_000_000_000, riskyWhen: 'lower',
  },
  {
    key: 'referralCommissionPercent', group: 'referral', label: 'Komisi referral', unit: '%',
    description: 'Persentase reward downline yang mengalir ke upline. Satu tingkat saja.',
    impact: 'Menaikkannya menaikkan biaya per task yang dikerjakan user yang punya upline.',
    min: 0, max: 50, riskyWhen: 'higher',
  },
  {
    key: 'dailyCommissionCapIdr', group: 'referral', label: 'Plafon komisi harian', unit: 'Rp/hari',
    description: 'Batas komisi yang diterima satu upline per hari. Terpisah dari plafon task.',
    impact: 'Menaikkannya menaikkan penghasilan maksimum dari jaringan referral.',
    min: 0, max: 1_000_000, riskyWhen: 'higher',
  },
  ...(
    [
      ['rankTier2Tasks', 'Artisan'], ['rankTier3Tasks', 'Expert'],
      ['rankTier4Tasks', 'Virtuoso'], ['rankTier5Tasks', 'Luminary'],
    ] as [EconomyConfigKey, string][]
  ).map(([key, label]): EconomyFieldMeta => ({
    key, group: 'progression', label: `Ambang rank ${label}`, unit: 'task',
    description: `Jumlah task selesai yang dibutuhkan untuk mencapai rank ${label}.`,
    impact: 'Menurunkannya mempercepat user mencapai rank tinggi, sehingga bonus kapasitas kolam datang lebih cepat.',
    min: 1, max: 1_000_000, riskyWhen: 'lower',
  })),
]

export type EconomyValidationErrors = Partial<Record<EconomyConfigKey, string>> & { _?: string }

export function validateEconomyConfig(input: unknown): {
  ok: true; config: EconomyConfig
} | {
  ok: false; errors: EconomyValidationErrors
} {
  const errors: EconomyValidationErrors = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { _: 'Konfigurasi harus berupa objek.' } }
  }
  const raw = input as Record<string, unknown>
  const config = {} as EconomyConfig

  for (const field of ECONOMY_FIELDS) {
    const value = raw[field.key]
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      errors[field.key] = 'Harus bilangan bulat.'
      continue
    }
    if (value < field.min || value > field.max) {
      errors[field.key] = `Harus di antara ${field.min} dan ${field.max}.`
      continue
    }
    config[field.key] = value
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const divisible: [EconomyConfigKey, string][] = [
    ['withdrawalMinimumIdr', 'Minimum penarikan'],
    ['maxPayoutIdr', 'Maksimum penarikan'],
    ['rewardPoolCapIdr', 'Kapasitas kolam dasar'],
    ['dailyCommissionCapIdr', 'Plafon komisi harian'],
  ]
  for (const [key, label] of divisible) {
    if (config[key] % config.creditValueIdr !== 0) {
      errors[key] = `${label} harus kelipatan nilai 1 credit (${config.creditValueIdr}).`
    }
  }

  const ladders: [EconomyConfigKey, EconomyConfigKey, EconomyConfigKey, string][] = [
    ['rewardEasy1', 'rewardEasy2', 'rewardEasy3', 'Mudah'],
    ['rewardMedium1', 'rewardMedium2', 'rewardMedium3', 'Sedang'],
    ['rewardHard1', 'rewardHard2', 'rewardHard3', 'Sulit'],
  ]
  for (const [one, two, three, label] of ladders) {
    if (!(config[one] <= config[two] && config[two] <= config[three])) {
      errors[three] = `Reward ${label} harus naik dari 1★ ke 3★.`
    }
  }

  const tiers: EconomyConfigKey[] = ['rankTier2Tasks', 'rankTier3Tasks', 'rankTier4Tasks', 'rankTier5Tasks']
  for (let i = 1; i < tiers.length; i += 1) {
    if (config[tiers[i]] <= config[tiers[i - 1]]) {
      errors[tiers[i]] = 'Ambang rank harus lebih besar dari rank sebelumnya.'
    }
  }

  const mathPairs: [EconomyConfigKey, EconomyConfigKey, string][] = [
    ['mathDigitsEasy', 'mathCeilingEasy', 'Mudah'],
    ['mathDigitsMedium', 'mathCeilingMedium', 'Sedang'],
    ['mathDigitsHard', 'mathCeilingHard', 'Sulit'],
  ]
  for (const [digits, ceiling, label] of mathPairs) {
    const smallest = 10 ** (config[digits] - 1)
    if (config[ceiling] < smallest) {
      errors[ceiling] =
        `Batas hasil Hitung ${label} harus minimal ${smallest} supaya muat ${config[digits]} digit.`
    }
  }

  if (config.maxPayoutIdr < config.withdrawalMinimumIdr) {
    errors.maxPayoutIdr = 'Maksimum penarikan tidak boleh di bawah minimumnya.'
  }

  if (config.maxPayoutIdr / config.creditValueIdr > 100_000_000) {
    errors.maxPayoutIdr = 'Maksimum penarikan melampaui batas yang diterima database untuk kolom credits.'
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, config }
}

let active: EconomyConfig = DEFAULT_ECONOMY_CONFIG

export function setActiveEconomyConfig(config: EconomyConfig): void {
  active = config
}

export function economyConfig(): EconomyConfig {
  return active
}

export function parTimeMs(difficulty: Difficulty): number {
  const config = active
  return difficulty === 'Easy'
    ? config.parTimeEasyMs
    : difficulty === 'Medium'
      ? config.parTimeMediumMs
      : config.parTimeHardMs
}

export function starReward(difficulty: Difficulty, stars: StarCount): number {
  const config = active
  if (difficulty === 'Easy') {
    return stars === 1 ? config.rewardEasy1 : stars === 2 ? config.rewardEasy2 : config.rewardEasy3
  }
  if (difficulty === 'Medium') {
    return stars === 1 ? config.rewardMedium1 : stars === 2 ? config.rewardMedium2 : config.rewardMedium3
  }
  return stars === 1 ? config.rewardHard1 : stars === 2 ? config.rewardHard2 : config.rewardHard3
}

export function textLength(difficulty: Difficulty): number {
  const config = active
  return difficulty === 'Easy'
    ? config.textLengthEasy
    : difficulty === 'Medium'
      ? config.textLengthMedium
      : config.textLengthHard
}

export function mathDigits(difficulty: Difficulty): number {
  const config = active
  return difficulty === 'Easy'
    ? config.mathDigitsEasy
    : difficulty === 'Medium'
      ? config.mathDigitsMedium
      : config.mathDigitsHard
}

export function mathCeiling(difficulty: Difficulty): number {
  const config = active
  return difficulty === 'Easy'
    ? config.mathCeilingEasy
    : difficulty === 'Medium'
      ? config.mathCeilingMedium
      : config.mathCeilingHard
}

export function selectOptionCount(difficulty: Difficulty): number {
  const config = active
  return difficulty === 'Easy'
    ? config.selectOptionsEasy
    : difficulty === 'Medium'
      ? config.selectOptionsMedium
      : config.selectOptionsHard
}

export function rankMinTasks(tier: number): number {
  const config = active
  if (tier <= 1) return 0
  if (tier === 2) return config.rankTier2Tasks
  if (tier === 3) return config.rankTier3Tasks
  if (tier === 4) return config.rankTier4Tasks
  return config.rankTier5Tasks
}
