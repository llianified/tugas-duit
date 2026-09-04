
import { minInAppWindowSeconds } from '@/domain/ads/in-app-ads'
import type { Difficulty } from '@/domain/task/challenge'
import type { StarCount } from '@/domain/progression/stars'

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
  adsMaxViewsPerDay: number
  adsCooldownSeconds: number
  adsTicketTtlSeconds: number
  adsPassTtlMinutes: number
  adsPostbackRequired: number
  adsMinWatchSeconds: number
  inAppAdsFrequency: number
  inAppAdsCappingMinutes: number
  inAppAdsIntervalSeconds: number
  inAppAdsTimeoutSeconds: number
  withdrawalMinimumIdr: number
  maxPayoutIdr: number
  withdrawalMinActiveReferrals: number
  withdrawalMinActiveDays: number
  withdrawalCooldownDays: number
  leaderboardEnabled: number
  missionTasksTarget: number
  missionTasksReward: number
  missionStarsTarget: number
  missionStarsReward: number
  missionAdsTarget: number
  missionAdsReward: number
  missionTwitterFollowReward: number
  missionTwitterLikeRepostReward: number
  missionTwitterPostReward: number
  missionFacebookPostReward: number
  referralCommissionPercent: number
  dailyCommissionCapIdr: number
  rankTier2Tasks: number
  rankTier3Tasks: number
  rankTier4Tasks: number
  rankTier5Tasks: number
  channelJoinBonusCredits: number
  channelGateEnabled: number
  premiumPrice1Idr: number
  premiumPrice2Idr: number
  premiumPrice3Idr: number
  premiumMaxEnergy: number
  premiumEnergyRegenMinutes: number
  premiumPoolCapBonus: number
  premiumMaxTasksPerDay: number
  premiumWithdrawalCooldownDays: number
  turboRewardEnabled: number
  arcadeEnabled: number
  arcadeAdGated: number
  arcadeMaxPlaysPerDay: number
  arcadeCooldownSeconds: number
  arcadeMatchSeconds: number
  arcadePoolPrizeCredits: number
  arcadePoolPrizeWeight: number
  arcadeEnergyPrizeAmount: number
  arcadeEnergyPrizeWeight: number
  arcadeBlankWeight: number
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
  adsMaxViewsPerDay: 10,
  adsCooldownSeconds: 120,
  adsTicketTtlSeconds: 300,
  adsPassTtlMinutes: 30,
  adsPostbackRequired: 0,
  adsMinWatchSeconds: 3,
  inAppAdsFrequency: 2,
  inAppAdsCappingMinutes: 6,
  inAppAdsIntervalSeconds: 30,
  inAppAdsTimeoutSeconds: 5,
  withdrawalMinimumIdr: 10_000,
  maxPayoutIdr: 2_000_000_000,
  withdrawalMinActiveReferrals: 5,
  withdrawalMinActiveDays: 7,
  withdrawalCooldownDays: 7,
  leaderboardEnabled: 1,
  missionTasksTarget: 5,
  missionTasksReward: 2,
  missionStarsTarget: 3,
  missionStarsReward: 2,
  missionAdsTarget: 3,
  missionAdsReward: 3,
  missionTwitterFollowReward: 1,
  missionTwitterLikeRepostReward: 1,
  missionTwitterPostReward: 1,
  missionFacebookPostReward: 1,
  referralCommissionPercent: 10,
  dailyCommissionCapIdr: 6_000,
  rankTier2Tasks: 100,
  rankTier3Tasks: 300,
  rankTier4Tasks: 700,
  rankTier5Tasks: 1_500,
  channelJoinBonusCredits: 25,
  channelGateEnabled: 1,
  premiumPrice1Idr: 19_900,
  premiumPrice2Idr: 34_900,
  premiumPrice3Idr: 44_900,
  premiumMaxEnergy: 10,
  premiumEnergyRegenMinutes: 25,
  premiumPoolCapBonus: 15,
  premiumMaxTasksPerDay: 1_000,
  premiumWithdrawalCooldownDays: 3,
  turboRewardEnabled: 1,
  // Arena aktif setelah angka hadiah, jatah, dan gerbang iklannya ditinjau. Saklar ini tetap
  // hidup di panel agar admin bisa menutupnya lagi tanpa deploy bila ekonomi perlu dihentikan.
  arcadeEnabled: 1,
  arcadeAdGated: 1,
  arcadeMaxPlaysPerDay: 3,
  arcadeCooldownSeconds: 300,
  arcadeMatchSeconds: 30,
  arcadePoolPrizeCredits: 5,
  arcadePoolPrizeWeight: 1,
  arcadeEnergyPrizeAmount: 1,
  arcadeEnergyPrizeWeight: 2,
  arcadeBlankWeight: 1,
}

export type EconomyGroup =
  | 'earnings'
  | 'reward'
  | 'task'
  | 'difficulty'
  | 'energy'
  | 'ads'
  | 'withdrawal'
  | 'referral'
  | 'progression'
  | 'channel'
  | 'premium'
  | 'mission'
  | 'arcade'
  | 'feature'

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
    min: 1, max: 10, riskyWhen: 'higher',
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
    key: 'adsMaxViewsPerDay', group: 'ads', label: 'Tayangan iklan per hari', unit: 'tayangan',
    description: 'Plafon tiket iklan berhadiah per user per hari WIB. Satu tiket membayar ongkos masuk satu task, bukan menambah credit. Isi 0 untuk mematikan fitur iklan tanpa deploy.',
    impact: 'Menaikkannya memperbanyak task yang bisa dimulai tanpa energi, sehingga plafon kolam reward habis lebih cepat.',
    min: 0, max: 100, riskyWhen: 'higher',
  },
  {
    key: 'adsCooldownSeconds', group: 'ads', label: 'Jeda antar tayangan', unit: 'detik',
    description: 'Jarak minimum antara dua pembukaan tiket iklan oleh user yang sama.',
    impact: 'Menurunkannya mempercepat tempo tayangan, sehingga plafon harian habis dalam waktu lebih singkat.',
    min: 0, max: 3_600, riskyWhen: 'lower',
  },
  {
    key: 'adsTicketTtlSeconds', group: 'ads', label: 'Umur tiket iklan', unit: 'detik',
    description: 'Waktu sejak tiket dibuka sampai klaimnya ditolak. Menahan tiket yang dibuka lalu disimpan untuk diklaim beramai-ramai nanti.',
    impact: 'Menaikkannya memberi lebih banyak waktu menonton, sekaligus memperlebar jendela klaim yang bisa disalahgunakan.',
    min: 30, max: 1_800, riskyWhen: 'higher',
  },
  {
    key: 'adsPassTtlMinutes', group: 'ads', label: 'Umur pass iklan', unit: 'menit',
    description: 'Waktu sejak klaim diterima sampai pass hangus tanpa dipakai. Memaksa hasil tontonan dipakai, bukan ditimbun.',
    impact: 'Menaikkannya membuat lebih banyak pass menganggur; menurunkannya membuat hasil tontonan lebih sering hangus.',
    min: 1, max: 1_440, riskyWhen: 'higher',
  },
  {
    key: 'adsPostbackRequired', group: 'ads', label: 'Wajib verifikasi postback', unit: 'status',
    description: 'Saat aktif, tiket iklan hanya terbit setelah Monetag mengonfirmasi tayangan lewat postback server-ke-server. Aktifkan hanya setelah URL postback terisi di dashboard Monetag dan kolom verified_at pada ad_views terbukti mulai terisi; jika belum, tidak ada tiket yang dapat terbit.',
    impact: 'Menurunkannya membuka kembali celah "tap iklan lalu back": tayangan yang tidak dibayar penyedia tetap menerbitkan tiket.',
    min: 0, max: 1, riskyWhen: 'lower',
  },
  {
    key: 'adsMinWatchSeconds', group: 'ads', label: 'Minimum tontonan iklan berhadiah', unit: 'detik',
    description: 'Hanya berlaku untuk tiket iklan berhadiah yang dibuka sendiri oleh user. Tiket ditolak kalau jarak antara tiket dibuka dan klaimnya masuk lebih pendek dari ini. Diukur dengan jam server, jadi tidak bisa dikarang klien. Tidak berlaku untuk interstitial otomatis `type: inApp`, karena format itu tidak memberi tiket atau hadiah. Jendelanya ikut memuat waktu memuat SDK, jadi setel dari sebaran ready_at - created_at yang sudah tercatat di ad_views, bukan dari perkiraan durasi iklan. Isi 0 untuk mematikannya pada iklan berhadiah.',
    impact: 'Menurunkannya membuka kembali celah "tap iklan lalu back" pada tiket berhadiah. Menaikkannya terlalu jauh menolak tontonan berhadiah yang sah, tetapi tidak mengubah frekuensi, jeda, atau perilaku interstitial in-app.',
    min: 0, max: 120, riskyWhen: 'lower',
  },
  {
    key: 'inAppAdsFrequency', group: 'ads', label: 'Interstitial per jendela', unit: 'iklan',
    description: 'Banyak interstitial otomatis yang ditayangkan dalam satu jendela. Ini iklan yang nongol sendiri sambil user memakai app — sumber impresi, bukan tiket berhadiah. Isi 0 untuk mematikan interstitial tanpa mematikan iklan berhadiah.',
    impact: 'Menaikkannya memperbanyak impresi per sesi, sekaligus memperbesar kemungkinan user menutup app karena terlalu sering disela.',
    min: 0, max: 20, riskyWhen: 'higher',
  },
  {
    key: 'inAppAdsCappingMinutes', group: 'ads', label: 'Panjang jendela interstitial', unit: 'menit',
    description: 'Lama satu jendela penayangan. Setelah jendela ini lewat, hitungan iklan mulai dari nol lagi dan tunda iklan pertama berjalan ulang. Karena jeda antar iklan hanya berlaku di dalam satu jendela, jendela inilah yang menentukan tempo saat plafonnya kecil: pada 1 iklan per jendela, jarak antar iklan sama dengan panjang jendela, bukan jeda yang diisi di bawah.',
    impact: 'Menurunkannya membuat jendela lebih cepat bergulir, sehingga plafon per jendela berlaku lebih sering.',
    min: 1, max: 1_440, riskyWhen: 'lower',
  },
  {
    key: 'inAppAdsIntervalSeconds', group: 'ads', label: 'Jeda antar interstitial', unit: 'detik',
    description: 'Jarak minimum antara dua interstitial di jendela yang sama. Tidak berlaku melintasi pergantian jendela — itu dijaga oleh panjang jendela, yang karenanya tidak boleh lebih pendek daripada jeda ini dikali plafon per jendela.',
    impact: 'Menurunkannya membuat iklan datang beruntun, yang paling sering jadi alasan user menutup app.',
    min: 0, max: 3_600, riskyWhen: 'lower',
  },
  {
    key: 'inAppAdsTimeoutSeconds', group: 'ads', label: 'Tunda interstitial pertama', unit: 'detik',
    description: 'Jeda sejak jendela dimulai sampai interstitial pertama boleh tayang. Memberi user waktu mengerjakan sesuatu sebelum disela.',
    impact: 'Menurunkannya membuat iklan menyambut user tepat saat app dibuka, sebelum ia sempat mengerjakan satu task pun.',
    min: 0, max: 600, riskyWhen: 'lower',
  },
  {
    key: 'withdrawalMinimumIdr', group: 'withdrawal', label: 'Minimum penarikan', unit: 'Rp',
    description: 'Nominal terkecil yang bisa diajukan. Menahan biaya transfer per payout.',
    impact: 'Menurunkannya membuat penarikan lebih sering, sehingga biaya transfer per rupiah naik.',
    min: 1_000, max: 10_000_000, riskyWhen: 'lower',
  },
  {
    key: 'withdrawalMinActiveReferrals', group: 'withdrawal', label: 'Referral aktif minimum',
    unit: 'referral',
    description: 'Berapa teman undangan yang harus sudah pernah mengerjakan task sebelum user boleh menarik dana. Isi 0 supaya user tanpa referral tetap bisa menarik — gerbang waktunya tetap dijaga syarat hari aktif, yang tidak bisa dipercepat dengan menggenjot task.',
    impact: 'Menurunkannya membuka penarikan untuk akun yang tidak membawa siapa pun, termasuk akun yang dibuat massal; menaikkannya mengunci user jujur yang tidak punya teman untuk diajak.',
    min: 0, max: 50, riskyWhen: 'lower',
  },
  {
    key: 'withdrawalMinActiveDays', group: 'withdrawal', label: 'Hari aktif minimum', unit: 'hari',
    description: 'Berapa hari WIB berbeda yang harus pernah punya minimal satu task selesai sebelum penarikan pertama bisa diajukan. Tidak harus berturut-turut, jadi satu hari bolong tidak menghapus progres. Sengaja bukan umur akun: pabrik akun cukup menunggu, sedangkan ini menuntut task betulan di hari-hari terpisah.',
    impact: 'Menurunkannya mempercepat penarikan pertama untuk semua orang, termasuk akun yang dibuat massal — ini gerbang waktu yang paling menahan pabrik akun.',
    min: 1, max: 365, riskyWhen: 'lower',
  },
  {
    key: 'withdrawalCooldownDays', group: 'withdrawal', label: 'Jeda antar penarikan', unit: 'hari',
    description: 'Jarak minimum antara dua pengajuan penarikan untuk user biasa. Jedanya berjalan dari tanggal pengajuan, termasuk pengajuan yang akhirnya ditolak. Tidak boleh lebih pendek daripada jeda premium — kalau sama, premium berhenti punya keunggulan di sini.',
    impact: 'Menurunkannya membuat penarikan lebih sering, sehingga biaya transfer per rupiah naik.',
    min: 1, max: 365, riskyWhen: 'lower',
  },
  {
    key: 'maxPayoutIdr', group: 'withdrawal', label: 'Maksimum penarikan', unit: 'Rp/pengajuan',
    description: 'Langit-langit satu pengajuan. Lantai kewarasan, bukan batas harian — saldo membatasi lebih dulu.',
    impact: 'Menaikkannya memperbesar nominal terbesar yang bisa diajukan sekali kirim.',
    min: 10_000, max: 2_000_000_000, riskyWhen: 'higher',
  },
  {
    key: 'referralCommissionPercent', group: 'referral', label: 'Komisi referral', unit: '%',
    description: 'Persentase reward downline yang mengalir ke upline. Satu tingkat saja. Tidak boleh 0: pada 0% tidak ada baris komisi yang ditulis, sedangkan syarat penarikan menghitung downline dari baris itu — jadi 0% mengunci penarikan setiap user yang belum terlanjur memenuhi syaratnya.',
    impact: 'Menaikkannya menaikkan biaya per task yang dikerjakan user yang punya upline.',
    min: 1, max: 50, riskyWhen: 'higher',
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
  {
    key: 'channelJoinBonusCredits', group: 'channel', label: 'Bonus join channel', unit: 'credit',
    description: 'Credit sekali seumur akun untuk user yang terbukti jadi anggota channel Telegram. Keanggotaannya diperiksa ke Telegram, bukan dipercaya dari klik. Isi 0 untuk mematikan kartunya tanpa deploy.',
    impact: 'Menaikkannya menaikkan biaya akuisisi setiap akun baru yang join channel.',
    min: 0, max: 1_000, riskyWhen: 'higher',
  },
  {
    key: 'channelGateEnabled', group: 'channel', label: 'Wajib join channel', unit: 'status',
    description: 'Saat aktif, aplikasi diblokir sampai pengguna terbukti menjadi anggota channel Telegram. Keanggotaan diperiksa ke Telegram dan hasilnya di-cache; jika Telegram tidak bisa dihubungi pengguna tetap diloloskan, dan penarikan saldo tidak pernah diblokir.',
    impact: 'Menyalakannya menutup akses semua user yang belum join, termasuk yang sudah punya saldo.',
    min: 0, max: 1, riskyWhen: 'higher',
  },
  {
    key: 'premiumPrice1Idr', group: 'premium', label: 'Harga premium 1 bulan', unit: 'Rp',
    description: 'Harga paket premium satu bulan sebelum kode unik dari QRIS ditambahkan.',
    impact: 'Menurunkannya menurunkan pendapatan langganan per pembeli.',
    min: 1_000, max: 10_000_000, riskyWhen: 'lower',
  },
  {
    key: 'premiumPrice2Idr', group: 'premium', label: 'Harga premium 2 bulan', unit: 'Rp',
    description: 'Harga paket dua bulan. Harus lebih murah per bulan daripada paket satu bulan.',
    impact: 'Menurunkannya menurunkan pendapatan langganan per pembeli.',
    min: 1_000, max: 10_000_000, riskyWhen: 'lower',
  },
  {
    key: 'premiumPrice3Idr', group: 'premium', label: 'Harga premium 3 bulan', unit: 'Rp',
    description: 'Harga paket tiga bulan. Harus lebih murah per bulan daripada paket dua bulan.',
    impact: 'Menurunkannya menurunkan pendapatan langganan per pembeli.',
    min: 1_000, max: 10_000_000, riskyWhen: 'lower',
  },
  {
    key: 'premiumMaxEnergy', group: 'premium', label: 'Kapasitas energi premium', unit: 'energi',
    description: 'Stok energi maksimum user premium. Tidak boleh di bawah kapasitas energi biasa, dan batas 10 datang dari constraint users_energy_range.',
    impact: 'Menaikkannya memperbanyak task yang bisa dikerjakan sekaligus oleh user premium.',
    min: 1, max: 10, riskyWhen: 'higher',
  },
  {
    key: 'premiumEnergyRegenMinutes', group: 'premium', label: 'Interval regen energi premium', unit: 'menit',
    description: 'Berapa menit sekali satu energi user premium terisi kembali. Tidak boleh lebih lambat daripada interval biasa.',
    impact: 'Menurunkannya mempercepat regen energi premium, sehingga plafon kolam habis lebih cepat.',
    min: 1, max: 1_440, riskyWhen: 'lower',
  },
  {
    key: 'premiumPoolCapBonus', group: 'premium', label: 'Bonus kapasitas kolam premium', unit: 'credit',
    description: 'Tambahan daya tampung kolam reward untuk user premium. Menambah yang bisa ditumpuk sebelum kolam penuh, bukan laju isi ulangnya — jadi penghasilan maksimum per hari tidak ikut naik.',
    impact: 'Menaikkannya memperbesar kolam user premium.',
    min: 0, max: 100, riskyWhen: 'higher',
  },
  {
    key: 'premiumMaxTasksPerDay', group: 'premium', label: 'Batas task harian premium', unit: 'task',
    description: 'Jaring anti-bot untuk user premium. Tidak boleh di bawah batas task harian biasa.',
    impact: 'Menaikkannya melonggarkan jaring anti-bot premium; tidak menaikkan payout karena kolam reward tetap mengikat.',
    min: 1, max: 100_000, riskyWhen: 'never',
  },
  ...(
    [
      ['missionTasksTarget', 'missionTasksReward', 'Selesaikan task', 'task'],
      ['missionStarsTarget', 'missionStarsReward', 'Task bintang tiga', 'task'],
      ['missionAdsTarget', 'missionAdsReward', 'Tonton iklan', 'tayangan'],
    ] as [EconomyConfigKey, EconomyConfigKey, string, string][]
  ).flatMap(([targetKey, rewardKey, label, unit]): EconomyFieldMeta[] => [
    {
      key: targetKey, group: 'mission', label: `Target · ${label}`, unit,
      description: `Berapa yang harus dikumpulkan dalam satu hari WIB supaya misi "${label}" bisa diklaim. Kemajuannya dihitung ulang dari task dan tayangan yang sudah tercatat, jadi mengubah angka ini langsung menggeser misi yang sedang berjalan hari itu.`,
      impact: 'Menurunkannya membuat misi lebih cepat kelar, sehingga energi bonusnya lebih sering keluar.',
      min: 1, max: 100, riskyWhen: 'lower',
    },
    {
      key: rewardKey, group: 'mission', label: `Hadiah · ${label}`, unit: 'energi',
      description: `Energi yang diberikan saat misi "${label}" diklaim. Tidak boleh melebihi kapasitas energi biasa: hadiah yang tidak muat utuh ditolak saat diklaim, jadi angka yang terlalu besar membuat misinya tidak pernah bisa diambil siapa pun.`,
      impact: 'Menaikkannya menambah energi gratis per hari, sehingga user sampai ke plafon kolamnya lebih cepat.',
      min: 1, max: 10, riskyWhen: 'higher',
    },
  ]),
  ...(
    [
      ['missionTwitterFollowReward', 'Follow Twitter', 'sekali per akun'],
      ['missionTwitterLikeRepostReward', 'Like & Retweet di X', 'sekali per akun'],
      ['missionTwitterPostReward', 'Post Twitter', 'sekali per hari WIB'],
      ['missionFacebookPostReward', 'Post Facebook', 'sekali per hari WIB'],
    ] as [EconomyConfigKey, string, string][]
  ).map(([key, label, cadence]): EconomyFieldMeta => ({
    key, group: 'mission', label: `Hadiah · ${label}`, unit: 'energi',
    description: `Energi yang diberikan untuk misi "${label}". Misi ini tersedia ${cadence}; konfirmasi baru aktif setelah aksi sosial dibuka selama 10 detik.`,
    impact: 'Menaikkannya menambah energi gratis dari aksi sosial, sehingga user sampai ke plafon kolamnya lebih cepat.',
    min: 1, max: 10, riskyWhen: 'higher',
  })),
  {
    key: 'leaderboardEnabled', group: 'feature', label: 'Papan peringkat', unit: 'status',
    description: 'Saat aktif, halaman Peringkat dan umpan aktivitas tampil untuk semua pengguna. Halaman ini memajang nama depan, foto Telegram, dan status premium; saat nonaktif halaman diganti dengan layar "segera hadir" tanpa menghapus data.',
    impact: 'Menyalakannya membuka data peringkat ke semua user; mematikannya menutup view-nya tanpa menghapus datanya.',
    min: 0, max: 1, riskyWhen: 'never',
  },
  {
    key: 'turboRewardEnabled', group: 'feature', label: 'Event Turbo Reward', unit: 'status',
    description: 'Saat aktif, promosi Turbo Reward tampil di beranda, tiket task, dan hasil task. Semua nominal event tetap mengikuti konfigurasi reward yang sedang aktif.',
    impact: 'Menyalakannya hanya mengubah komunikasi di UI; nilai reward tetap ditentukan oleh setelan reward dan kolam.',
    min: 0, max: 1, riskyWhen: 'never',
  },
  {
    key: 'premiumWithdrawalCooldownDays', group: 'premium', label: 'Jeda penarikan premium', unit: 'hari',
    description: 'Jarak minimum antara dua pengajuan penarikan user premium. Menggantikan jeda 7 hari yang berlaku untuk user biasa.',
    impact: 'Menurunkannya membuat user premium menarik lebih sering, sehingga biaya transfer per rupiah naik.',
    min: 1, max: 365, riskyWhen: 'lower',
  },
  {
    key: 'arcadeEnabled', group: 'arcade', label: 'Arena', unit: 'status',
    description: 'Saat aktif, pengguna dapat membuka Arena. Ini satu-satunya fitur yang hadiahnya dapat mengisi stok reward, sehingga dapat menambah rupiah yang harus dibayarkan. Biaya maksimum per pengguna per hari = jatah main × isi stok per hadiah × nilai satu credit.',
    impact: 'Menaikkannya membuka jalur hadiah yang menaikkan plafon payout, bukan cuma mempercepat user mencapainya.',
    min: 0, max: 1, riskyWhen: 'higher',
  },
  {
    key: 'arcadeAdGated', group: 'arcade', label: 'Arena dikunci iklan', unit: 'status',
    description: 'Saat aktif, setiap permainan memakai satu pass iklan berhadiah, seperti tiket yang membayar biaya masuk task. Mekanisme ini membantu menutup biaya hadiah Arena.',
    impact: 'Menurunkannya membuat hadiah Arena dibayar tanpa satu impresi iklan pun yang mendanainya.',
    min: 0, max: 1, riskyWhen: 'lower',
  },
  {
    key: 'arcadeMaxPlaysPerDay', group: 'arcade', label: 'Jatah main per hari', unit: 'main',
    description: 'Berapa kali satu user boleh membuka Arena dalam satu hari WIB. Ini plafon biaya harian fitur ini, dan satu-satunya penjaga yang tidak bergantung pada kejujuran klien.',
    impact: 'Menaikkannya menaikkan biaya hadiah maksimum per user per hari secara langsung.',
    min: 1, max: 100, riskyWhen: 'higher',
  },
  {
    key: 'arcadeCooldownSeconds', group: 'arcade', label: 'Jeda antar main', unit: 'detik',
    description: 'Jarak minimum antara dua kali membuka Arena. Menyebar jatah harian sepanjang hari, bukan habis dalam satu menit.',
    impact: 'Menurunkannya membuat jatah harian habis dalam satu duduk, sehingga alasan untuk kembali ikut hilang.',
    min: 0, max: 86_400, riskyWhen: 'lower',
  },
  {
    key: 'arcadeMatchSeconds', group: 'arcade', label: 'Waktu Cocokkan Kartu', unit: 'detik',
    description: 'Batas waktu satu ronde Cocokkan Kartu. Ini yang menentukan seberapa sering ronde berakhir menang, jadi ia menggeser berapa banyak hadiah yang benar-benar keluar.',
    impact: 'Menaikkannya membuat lebih banyak ronde berakhir menang, sehingga lebih banyak hadiah dibayarkan.',
    min: 5, max: 300, riskyWhen: 'higher',
  },
  {
    key: 'arcadePoolPrizeCredits', group: 'arcade', label: 'Hadiah isi stok', unit: 'credit',
    description: 'Credit yang masuk ke stok reward saat hadiah isi stok keluar. Dijepit kapasitas stok user; hadiah yang tidak muat seluruhnya dicoret dari undian, bukan dibayar sebagian.',
    impact: 'Menaikkannya menaikkan rupiah yang bisa ditarik user, karena stok reward adalah plafon payout-nya.',
    min: 1, max: 1_000, riskyWhen: 'higher',
  },
  {
    key: 'arcadePoolPrizeWeight', group: 'arcade', label: 'Bobot hadiah isi stok', unit: 'bobot',
    description: 'Peluang relatif hadiah isi stok terhadap dua hadiah lain. Isi 0 untuk mematikannya tanpa mematikan Arena.',
    impact: 'Menaikkannya memperbesar porsi undian yang berujung isi stok, sehingga biaya rata-rata per main naik.',
    min: 0, max: 100, riskyWhen: 'higher',
  },
  {
    key: 'arcadeEnergyPrizeAmount', group: 'arcade', label: 'Hadiah energi', unit: 'energi',
    description: 'Energi yang diberikan saat hadiah energi keluar. Dicoret dari undian kalau tidak muat seluruhnya di kapasitas energi user.',
    impact: 'Energi tidak menggeser plafon payout sedikit pun; ia hanya membuat user sampai ke plafonnya lewat lebih banyak task, dan itu berarti lebih banyak tayangan iklan.',
    min: 1, max: 50, riskyWhen: 'never',
  },
  {
    key: 'arcadeEnergyPrizeWeight', group: 'arcade', label: 'Bobot hadiah energi', unit: 'bobot',
    description: 'Peluang relatif hadiah energi. Hadiah termurah yang ada: biayanya nol rupiah.',
    impact: 'Porsi undian yang berujung energi tidak menambah satu rupiah pun yang harus dibayarkan.',
    min: 0, max: 100, riskyWhen: 'never',
  },
  {
    key: 'arcadeBlankWeight', group: 'arcade', label: 'Bobot zonk', unit: 'bobot',
    description: 'Peluang relatif tidak dapat apa-apa. Isi 0 kalau setiap main harus berhadiah.',
    impact: 'Menurunkannya memperbesar porsi undian yang berhadiah, sehingga biaya rata-rata per main naik.',
    min: 0, max: 100, riskyWhen: 'lower',
  },
]

export type EconomyValidationErrors = Partial<Record<EconomyConfigKey, string>> & { _?: string }

/** `fillMissing` HANYA untuk baris yang dibaca dari database, tidak pernah untuk masukan admin. Menambah satu key baru di kode berarti ada jendela — antara deploy dan migrasi yang mengisi key itu — ketika baris tersimpan belum memilikinya. Tanpa toleransi ini, jendela tersebut mematikan SELURUH API: `loadEconomyConfig` dipanggil hampir setiap route, dan satu key yang hilang membuat baris utuh ditolak. Itu persis yang terjadi saat `withdrawalMinActiveReferrals` masuk, dan bentuk kegagalan yang sama sudah pernah merobohkan produksi lewat migrasi 0027. Yang ditoleransi hanya key yang benar-benar TIDAK ADA. Key yang ada tapi bukan bilangan bulat, atau di luar rentangnya, tetap menggagalkan baris — penjagaan itu yang menangkap konfigurasi rusak, dan tidak boleh ikut dilonggarkan. */
export function validateEconomyConfig(
  input: unknown,
  options: { fillMissing?: boolean } = {},
): {
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
  const filled: EconomyConfigKey[] = []

  for (const field of ECONOMY_FIELDS) {
    const value = raw[field.key]
    if (options.fillMissing && value === undefined) {
      config[field.key] = DEFAULT_ECONOMY_CONFIG[field.key]
      filled.push(field.key)
      continue
    }
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

  if (filled.length > 0) {
    console.warn(
      `[economy-config] key belum ada di baris tersimpan, dipakai nilai bawaan: ${filled.join(', ')}. Jalankan pnpm db:migrate.`,
    )
  }

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

  /** Jadwal interstitial harus muat di jendelanya sendiri DAN tidak boleh bergulir lebih rapat daripada jeda antar iklannya. Syarat pertama menjaga plafon `inAppAdsFrequency` tetap bisa tercapai; syarat kedua menjaga `inAppAdsIntervalSeconds` tetap berarti, karena SDK Monetag menghitung jeda itu hanya di dalam satu jendela dan memulai `timeout` dari nol setiap jendela baru. Tanpa syarat kedua, jendela pendek diam-diam menggantikan jeda: `frequency: 1` dengan jendela 1 menit menayangkan iklan tiap menit berapa pun jeda yang diisi admin. */
  if (config.inAppAdsFrequency > 0) {
    const needed = minInAppWindowSeconds({
      frequency: config.inAppAdsFrequency,
      intervalSeconds: config.inAppAdsIntervalSeconds,
      timeoutSeconds: config.inAppAdsTimeoutSeconds,
    })
    const window = config.inAppAdsCappingMinutes * 60
    if (needed > window) {
      errors.inAppAdsCappingMinutes =
        `Jendela ${config.inAppAdsCappingMinutes} menit terlalu pendek untuk ${config.inAppAdsFrequency} iklan dengan tunda ${config.inAppAdsTimeoutSeconds} detik dan jeda ${config.inAppAdsIntervalSeconds} detik: butuh minimal ${Math.ceil(needed / 60)} menit. Jendela yang lebih pendek bergulir sebelum jedanya lewat, jadi iklan pertama jendela berikutnya datang lebih cepat daripada jeda yang disetel.`
    }
  }

  if (config.energyCostPerTask > config.maxEnergy) {
    errors.energyCostPerTask =
      `Biaya energi per task tidak boleh melebihi kapasitas energi (${config.maxEnergy}).`
  }

  if (config.premiumMaxEnergy < config.maxEnergy) {
    errors.premiumMaxEnergy =
      `Kapasitas energi premium tidak boleh di bawah kapasitas biasa (${config.maxEnergy}).`
  }

  if (config.premiumEnergyRegenMinutes > config.energyRegenMinutes) {
    errors.premiumEnergyRegenMinutes =
      `Regen energi premium tidak boleh lebih lambat daripada regen biasa (${config.energyRegenMinutes} menit).`
  }

  /** Target misi iklan tidak boleh melewati plafon tayangan hariannya: misi yang menuntut 15 tayangan sementara plafonnya 10 tidak pernah bisa diselesaikan siapa pun, dan gagalnya diam — yang terlihat user cuma progres yang berhenti di 10/15 tiap hari. Bentuk kesalahan yang sama dengan hadiah misi yang tidak muat di kapasitas energi, jadi ditangkap di tempat yang sama. | Diperiksa hanya saat plafonnya di atas nol. `adsMaxViewsPerDay = 0` adalah tombol mati iklan, dan tombol itu harus tetap satu field: yang menangani misinya di situ `missions()`, yang berhenti menerbitkan misi iklan selama iklannya mati. */
  if (config.adsMaxViewsPerDay > 0 && config.missionAdsTarget > config.adsMaxViewsPerDay) {
    errors.missionAdsTarget =
      `Target misi "Tonton iklan" tidak boleh melebihi plafon tayangan harian (${config.adsMaxViewsPerDay}), karena misi yang menuntut lebih banyak tayangan daripada yang boleh ditonton tidak pernah bisa diselesaikan.`
  }

  /** Hadiah misi harus muat di kapasitas energi biasa, bukan premium: `claimMission` menolak klaim yang hadiahnya terpotong, jadi hadiah yang lebih besar dari kapasitas membuat misinya tidak pernah bisa diambil user non-premium — gagal diam-diam, karena yang terlihat cuma tombol klaim yang selalu menolak. */
  const missionRewards: [EconomyConfigKey, string][] = [
    ['missionTasksReward', 'Selesaikan task'],
    ['missionStarsReward', 'Task bintang tiga'],
    ['missionAdsReward', 'Tonton iklan'],
    ['missionTwitterFollowReward', 'Follow Twitter'],
    ['missionTwitterLikeRepostReward', 'Like & Retweet di X'],
    ['missionTwitterPostReward', 'Post Twitter'],
    ['missionFacebookPostReward', 'Post Facebook'],
  ]
  for (const [key, label] of missionRewards) {
    if (config[key] > config.maxEnergy) {
      errors[key] =
        `Hadiah misi "${label}" tidak boleh melebihi kapasitas energi (${config.maxEnergy}), karena hadiah yang tidak muat utuh akan ditolak saat diklaim.`
    }
  }

  if (config.premiumWithdrawalCooldownDays > config.withdrawalCooldownDays) {
    errors.premiumWithdrawalCooldownDays =
      `Jeda penarikan premium tidak boleh lebih panjang daripada jeda biasa (${config.withdrawalCooldownDays} hari).`
  }

  if (config.premiumMaxTasksPerDay < config.maxTasksPerDay) {
    errors.premiumMaxTasksPerDay =
      `Batas task harian premium tidak boleh di bawah batas biasa (${config.maxTasksPerDay}).`
  }

  if (config.premiumPrice2Idr >= config.premiumPrice1Idr * 2) {
    errors.premiumPrice2Idr = 'Paket 2 bulan harus lebih murah per bulan daripada paket 1 bulan.'
  }

  if (config.premiumPrice3Idr * 2 >= config.premiumPrice2Idr * 3) {
    errors.premiumPrice3Idr = 'Paket 3 bulan harus lebih murah per bulan daripada paket 2 bulan.'
  }

  if (config.maxPayoutIdr < config.withdrawalMinimumIdr) {
    errors.maxPayoutIdr = 'Maksimum penarikan tidak boleh di bawah minimumnya.'
  }

  if (config.maxPayoutIdr / config.creditValueIdr > 100_000_000) {
    errors.maxPayoutIdr = 'Maksimum penarikan melampaui batas yang diterima database untuk kolom credits.'
  }

  /** Arena yang menyala tanpa satu pun hadiah berbobot adalah mesin zonk: user membakar pass iklan untuk hasil yang sudah pasti kosong. `hasWinnablePrize` menolaknya saat dijalankan, tapi penolakan itu terbaca user sebagai fitur rusak, bukan sebagai setelan. Ditangkap di sini supaya salah setelnya berhenti di form panel. */
  if (config.arcadeEnabled > 0 && config.arcadePoolPrizeWeight + config.arcadeEnergyPrizeWeight <= 0) {
    errors.arcadeBlankWeight =
      'Arena butuh minimal satu hadiah berbobot. Isi bobot hadiah isi stok atau bobot hadiah energi di atas 0, atau matikan Arena.'
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
