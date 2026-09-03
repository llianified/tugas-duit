import { adsConfigured } from '../ads/ads'
import { economyConfig } from '../economy/economy-config'

/** Arena: dua permainan yang hadiahnya **energi atau isi stok reward**, tidak pernah credit. Bedanya dengan misi harian bukan kosmetik. Misi membayar energi saja, dan energi berbiaya nol karena kolam reward tetap mematok berapa credit yang bisa keluar. Arena boleh membayar isi stok, dan itu **menaikkan plafon payout** — satu-satunya hadiah yang benar-benar membuka layar "stok habis", dan satu-satunya yang berbiaya nyata. Biayanya dibatasi dari tiga arah sekaligus: jatah main harian, cooldown, dan bobot undian yang semuanya dari panel admin. Ongkos itu dibeli balik oleh iklan berhadiah yang mengunci tiap kali main (`arcadeAdGated`). */

export type ArcadeGame = 'boxes' | 'match'

export const ARCADE_GAMES: readonly ArcadeGame[] = ['boxes', 'match']

/** Terpaku pada grid tiga kolom di `features/arcade/lucky-boxes.tsx` dan pada constraint `arcade_plays_pick_range` di migrasi 0038. Bukan besaran ekonomi: mengubahnya mengubah bentuk layar dan arti kolom `pick`, bukan berapa yang dibayar. */
export const BOX_COUNT = 3

/** Tiga pasang, enam kartu. Angkanya terpaku pada grid kartu di `features/arcade/card-match.tsx`; yang bisa disetel dari panel adalah waktunya, karena itu yang menggeser peluang menang dan dengan begitu biayanya. */
export const MATCH_PAIRS = 3

/** Umur satu main yang dibuka tapi tidak pernah disetel. Operasional, bukan ekonomi: ia tidak menggeser satu rupiah pun, hanya membebaskan slot `arcade_plays_one_open` supaya app yang tertutup di tengah ronde tidak mengunci Arena user itu selamanya. Dipilih longgar karena ronde terpanjang yang bisa disetel panel adalah `arcadeMatchSeconds` maksimum 300 detik. | Tinggal di `domain/` supaya `server/ads/ads.ts` bisa ikut membacanya saat menghitung ongkos masuk yang masih terbuka, tanpa mengimpor `server/arcade/arcade.ts` yang justru mengimpor balik `consumeAdPass` dari sana. */
export const ARCADE_OPEN_PLAY_TTL_MINUTES = 15

export type ArcadePrizeKind = 'pool' | 'energy' | 'blank'

export interface ArcadePrize {
  kind: ArcadePrizeKind
  amount: number
}

export interface ArcadePrizeEntry extends ArcadePrize {
  weight: number
}

export const BLANK_PRIZE: ArcadePrize = { kind: 'blank', amount: 0 }

/** Arena yang dikunci iklan ikut tertutup saat `adsMaxViewsPerDay` diisi 0. Ongkos masuknya satu pass iklan, dan pass itu tidak akan pernah bisa dibuat selama tombol mati iklan menyala — tanpa penjagaan ini kartunya tetap terpampang dan tombolnya menjanjikan "tonton satu iklan" yang dijawab "iklan lagi tidak tersedia". Menutupnya memakai layar `ArcadeClosed` yang sudah ada: fitur yang dimatikan dari panel adalah keadaan normal di app ini. Ronde yang terlanjur terbuka tetap bisa disetel, karena `settleArcadePlay` sengaja tidak memeriksa saklar ini. */
export function arcadeEnabled(): boolean {
  if (economyConfig().arcadeEnabled <= 0) return false
  return !arcadeAdGated() || adsConfigured()
}

export function arcadeAdGated(): boolean {
  return economyConfig().arcadeAdGated > 0
}

export function arcadeMaxPlaysPerDay(): number {
  return economyConfig().arcadeMaxPlaysPerDay
}

export function arcadeCooldownSeconds(): number {
  return economyConfig().arcadeCooldownSeconds
}

export function arcadeMatchSeconds(): number {
  return economyConfig().arcadeMatchSeconds
}

/** Tabel hadiah lengkap, termasuk yang bobotnya nol. Yang menyaring mana yang boleh keluar adalah `eligiblePrizes`, bukan fungsi ini — supaya panel admin dan layar bantuan bisa menampilkan seluruh tabel apa adanya. */
export function arcadePrizeTable(): ArcadePrizeEntry[] {
  const config = economyConfig()
  return [
    { kind: 'pool', amount: config.arcadePoolPrizeCredits, weight: config.arcadePoolPrizeWeight },
    { kind: 'energy', amount: config.arcadeEnergyPrizeAmount, weight: config.arcadeEnergyPrizeWeight },
    { kind: 'blank', amount: 0, weight: config.arcadeBlankWeight },
  ]
}

export interface ArcadeHeadroom {
  /** Sisa kapasitas kolam reward: berapa credit lagi yang muat sebelum dijepit. */
  pool: number
  /** Sisa kapasitas energi. */
  energy: number
}

/** Hadiah yang tidak muat SELURUHNYA dicoret dari undian, bukan dibayar sebagian. Alasannya sudah ditulis dua kali di repo ini: `applyEnergyGrant` memotong di `maxEnergy()` dan `applyRewardPoolRefund` menjepit di kapasitas, jadi hadiah yang lebih besar dari sisa ruang hilang tanpa jejak sementara barisnya terlanjur mencatat angka penuh. `claimMission` menolak di depan karena alasan yang sama. Di sini penolakannya lebih halus: undiannya yang menyempit, jadi user tetap dapat sesuatu selama masih ada satu hadiah yang muat. */
export function eligiblePrizes(headroom: ArcadeHeadroom): ArcadePrizeEntry[] {
  return arcadePrizeTable().filter((entry) => {
    if (entry.weight <= 0) return false
    if (entry.kind === 'pool') return headroom.pool >= entry.amount
    if (entry.kind === 'energy') return headroom.energy >= entry.amount
    return true
  })
}

/** Ada hadiah yang benar-benar bisa jatuh, bukan cuma zonk. Dipakai untuk menolak pembukaan main SEBELUM tiket iklannya dibakar: menyuruh orang menonton iklan demi zonk yang sudah pasti adalah cara tercepat membuat fitur ini dibenci. */
export function hasWinnablePrize(headroom: ArcadeHeadroom): boolean {
  return eligiblePrizes(headroom).some((entry) => entry.kind !== 'blank')
}

/** `roll` di [0,1). Undian dipisah dari sumber acaknya supaya bisa diuji tanpa menyetel `Math.random`, dan supaya server tetap yang menggulirkan — klien tidak pernah mengirim hasil undian. */
export function drawPrize(entries: readonly ArcadePrizeEntry[], roll: number): ArcadePrize {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return BLANK_PRIZE

  const clamped = Math.min(Math.max(roll, 0), 0.999_999_999)
  let cursor = clamped * total
  for (const entry of entries) {
    cursor -= entry.weight
    if (cursor < 0) return { kind: entry.kind, amount: entry.amount }
  }
  return BLANK_PRIZE
}

export type ArcadeRefusal =
  | 'arcade_disabled'
  | 'daily_cap'
  | 'cooldown'
  | 'play_open'
  | 'no_ad_pass'
  | 'nothing_to_win'

export interface ArcadeOpenState {
  playsToday: number
  lastOpenedAt: number | null
  hasOpenPlay: boolean
  hasAdPass: boolean
  headroom: ArcadeHeadroom
}

export function arcadePlaysLeft(playsToday: number): number {
  return Math.max(0, arcadeMaxPlaysPerDay() - Math.max(0, playsToday))
}

export function arcadeCooldownSecondsLeft(lastOpenedAt: number | null, now: number): number {
  if (lastOpenedAt === null) return 0
  const elapsed = Math.floor((now - lastOpenedAt) / 1_000)
  return Math.max(0, arcadeCooldownSeconds() - elapsed)
}

export function arcadeCooldownUntil(lastOpenedAt: number | null): number | null {
  if (lastOpenedAt === null) return null
  return lastOpenedAt + arcadeCooldownSeconds() * 1_000
}

/** Urutannya bukan selera: penolakan yang bisa diperbaiki user sendiri diperiksa paling akhir. `play_open` mendahului cooldown supaya main yang belum ditutup tidak terbaca sebagai "tunggu dulu", dan `nothing_to_win` berdiri paling belakang karena ia satu-satunya yang butuh membaca stok dan energi. */
export function arcadeOpenRefusal(state: ArcadeOpenState, now: number): ArcadeRefusal | null {
  if (!arcadeEnabled()) return 'arcade_disabled'
  if (state.hasOpenPlay) return 'play_open'
  if (arcadePlaysLeft(state.playsToday) <= 0) return 'daily_cap'
  if (arcadeCooldownSecondsLeft(state.lastOpenedAt, now) > 0) return 'cooldown'
  if (arcadeAdGated() && !state.hasAdPass) return 'no_ad_pass'
  if (!hasWinnablePrize(state.headroom)) return 'nothing_to_win'
  return null
}

export function isArcadeGame(value: unknown): value is ArcadeGame {
  return typeof value === 'string' && ARCADE_GAMES.includes(value as ArcadeGame)
}
