/** Toko TD: aturan murni, tanpa I/O. Rak tempat saldo berkurang tanpa ditarik jadi Rupiah, dan —
 * sejak migrasi 0058 — tempat Rupiah masuk tanpa lewat premium.
 *
 * Arahnya sengaja kebalikan dari seluruh repo. Misi, Arena, dan komisi menambah liabilitas; toko
 * menghapusnya. TD yang dibelanjakan di sini hilang dari neraca dan tidak pernah kembali sebagai
 * penarikan — itu gunanya, bukan efek sampingnya.
 *
 * Isi raknya dijaga satu aturan: barang yang dijual tidak boleh menambah plafon payout. Energi
 * lolos karena kolam reward tetap mematok berapa credit yang bisa keluar — energi hanya mengubah
 * SECEPAT apa user sampai ke plafonnya, bukan seberapa tinggi plafonnya. Pass Gaspol lolos dengan
 * argumen yang sama persis, dan itu argumen yang sudah dibayar tiket iklan di migrasi 0024: yang
 * dibeli ongkos masuk, bukan hadiah. Tarik Sekarang lolos karena ia tidak menambah satu credit pun,
 * cuma menggeser kapan saldo yang sudah ada boleh keluar. Premium lolos karena yang dibeli adalah
 * langganan yang selama ini dibayar tunai. Kosmetik lolos karena ia tidak menyentuh apa pun.
 *
 * **Dua harga, satu barang.** `priceCredits` menebus pakai saldo, `priceIdr` membayar pakai QRIS,
 * dan sebuah barang boleh punya salah satu, keduanya, atau — untuk premium — hanya yang pertama
 * karena jalur tunainya sudah punya lembarnya sendiri. Harga TD SELALU bernilai lebih besar
 * daripada harga Rupiah-nya; `validateEconomyConfig` yang menegakkannya. Alasannya bukan gengsi:
 * TD adalah liabilitas yang kalau tidak dibelanjakan akan ditarik jadi Rupiah, jadi menebus pakai
 * TD memang harus lebih mahal supaya toko menyerap saldo alih-alih menggantikan pemasukan tunai. */

import { economyConfig } from '@/domain/economy/economy-config'
import type { PremiumMonths } from '@/domain/economy/premium'
import { COSMETICS, isCosmeticKey, type CosmeticKey } from './cosmetics'

export type StoreItemKey =
  | 'energy_refill'
  | 'premium_month'
  | 'gaspol_pass'
  | 'withdraw_skip'
  | CosmeticKey

/** Bagian rak. Bukan kategori demi kategori: keduanya dijawab pertanyaan yang berbeda — yang satu
 * "biar dapat lebih banyak", yang satu "biar kelihatan" — dan menumpuknya dalam satu daftar panjang
 * membuat yang kedua terbaca seperti barang yang gagal berguna. */
export type StoreSection = 'boost' | 'cosmetic'

export type StoreItemEffect =
  | { kind: 'energy'; amount: number }
  | { kind: 'premium'; months: PremiumMonths }
  | { kind: 'gaspol'; minutes: number }
  | { kind: 'withdraw_skip' }
  | { kind: 'cosmetic'; cosmetic: CosmeticKey }

export interface StoreItem {
  key: StoreItemKey
  section: StoreSection
  title: string
  detail: string
  /** Harga tebus pakai saldo. `null` berarti barangnya hanya bisa dibayar QRIS. */
  priceCredits: number | null
  /** Harga bayar pakai QRIS. `null` berarti barangnya hanya bisa ditebus pakai saldo. */
  priceIdr: number | null
  effect: StoreItemEffect
}

export type StorePayment = 'credits' | 'cash'

export function storeEnabled(): boolean {
  return economyConfig().storeEnabled > 0
}

export function storeCosmeticsEnabled(): boolean {
  return economyConfig().storeCosmeticsEnabled > 0
}

export function gaspolMinutes(): number {
  return economyConfig().storeGaspolMinutes
}

/** Rak lengkap, urut sesuai urutan tampilnya. Barang fungsional dulu, kosmetik belakangan.
 *
 * Premium sengaja TIDAK punya harga Rupiah di sini. Jalur tunainya sudah ada — lembar premium
 * dengan lima paketnya — dan menaruh tombol Rupiah kedua di rak ini cuma menjual paket satu bulan
 * dengan harga per bulan paling mahal kepada orang yang tidak melihat pembandingnya. */
export function storeCatalog(): StoreItem[] {
  return buildCatalog(storeCosmeticsEnabled())
}

/** Katalog TANPA saklar rak kosmetik. Dipakai satu jalur saja: penyerahan barang yang UANGNYA
 * SUDAH MASUK. Admin boleh menutup rak kosmetik kapan saja, dan pesanan QRIS yang terbit sebelum
 * saklarnya dimatikan tetap harus bisa diserahkan — kalau tidak, saklar tampilan berubah jadi
 * saklar yang menelan pembayaran orang. */
export function fulfilmentCatalog(): StoreItem[] {
  return buildCatalog(true)
}

function buildCatalog(includeCosmetics: boolean): StoreItem[] {
  const config = economyConfig()

  const items: StoreItem[] = [
    {
      key: 'energy_refill',
      section: 'boost',
      title: `Tambah ${config.storeEnergyAmount} energi`,
      detail: 'Langsung masuk, nggak perlu nunggu isi ulang.',
      priceCredits: config.storeEnergyPriceCredits,
      priceIdr: null,
      effect: { kind: 'energy', amount: config.storeEnergyAmount },
    },
    {
      key: 'gaspol_pass',
      section: 'boost',
      title: `Pass Gaspol ${config.storeGaspolMinutes} menit`,
      detail: 'Selama pass-nya jalan, ngerjain soal nggak motong energi sama sekali.',
      priceCredits: config.storeGaspolPriceCredits,
      priceIdr: config.storeGaspolPriceIdr,
      effect: { kind: 'gaspol', minutes: config.storeGaspolMinutes },
    },
    {
      key: 'withdraw_skip',
      section: 'boost',
      title: 'Tarik Sekarang',
      detail: 'Lewati jeda penarikan sekali. Berlaku buat satu pengajuan berikutnya.',
      priceCredits: config.storeWithdrawSkipPriceCredits,
      priceIdr: config.storeWithdrawSkipPriceIdr,
      effect: { kind: 'withdraw_skip' },
    },
    {
      key: 'premium_month',
      section: 'boost',
      title: 'Premium 1 bulan',
      detail: 'Manfaatnya sama persis dengan premium yang dibeli pakai QRIS.',
      priceCredits: config.storePremiumMonthPriceCredits,
      priceIdr: null,
      effect: { kind: 'premium', months: 1 },
    },
  ]

  if (!includeCosmetics) return items

  for (const item of COSMETICS) {
    const frame = item.kind === 'frame'
    items.push({
      key: item.key,
      section: 'cosmetic',
      title: item.name,
      detail: item.detail,
      priceCredits: frame ? config.storeFramePriceCredits : config.storeTitlePriceCredits,
      priceIdr: frame ? config.storeFramePriceIdr : config.storeTitlePriceIdr,
      effect: { kind: 'cosmetic', cosmetic: item.key },
    })
  }

  return items
}

export const STORE_ITEM_KEYS: readonly StoreItemKey[] = [
  'energy_refill',
  'gaspol_pass',
  'withdraw_skip',
  'premium_month',
  ...COSMETICS.map((item) => item.key),
]

/** Barang di rak yang SEDANG berlaku, atau `null`. Bentuknya sengaja bukan yang melempar: rak
 * kosmetik bisa ditutup admin tanpa deploy, jadi key yang sah menurut `isStoreItemKey` tetap bisa
 * tidak ada di katalog hari ini — dan itu penolakan biasa, bukan kerusakan. */
export function findStoreItem(key: StoreItemKey): StoreItem | null {
  return storeCatalog().find((item) => item.key === key) ?? null
}

/** Barang untuk penyerahan, dicari di katalog penuh. Lihat `fulfilmentCatalog`. */
export function findStoreItemForFulfilment(key: StoreItemKey): StoreItem | null {
  return fulfilmentCatalog().find((item) => item.key === key) ?? null
}

export function storeItem(key: StoreItemKey): StoreItem {
  const found = findStoreItem(key)
  if (!found) throw new Error(`Barang toko tidak dikenal: ${key}`)
  return found
}

export function isStoreItemKey(value: unknown): value is StoreItemKey {
  return typeof value === 'string' && STORE_ITEM_KEYS.includes(value as StoreItemKey)
}

/** Harga barang untuk satu cara bayar, atau `null` kalau barangnya memang tidak dijual lewat situ.
 * Satu tempat yang menjawabnya supaya jalur TD dan jalur QRIS tidak masing-masing membaca field
 * yang berbeda lalu menyimpang. */
export function storePrice(item: StoreItem, payment: StorePayment): number | null {
  return payment === 'credits' ? item.priceCredits : item.priceIdr
}

export type StorePurchaseRefusal =
  | 'store_disabled'
  | 'unknown_item'
  | 'payment_unavailable'
  | 'insufficient_balance'
  | 'energy_full'
  | 'pool_empty'
  | 'already_owned'
  | 'no_cooldown'
  | 'withdrawal_processing'

export interface StorePurchaseState {
  balance: number
  /** Energi yang sudah diproyeksikan ke sekarang, bukan angka mentah dari kolom. */
  energy: number
  maxEnergy: number
  /** Sisa stok kolam reward. Ikut diperiksa untuk energi — lihat alasannya di bawah. */
  rewardPoolCredits: number
  /** Kosmetik yang sudah dimiliki. Yang sudah punya tidak boleh membayar lagi. */
  ownedCosmetics: readonly CosmeticKey[]
  /** Jeda penarikan sedang berjalan atau tidak. */
  withdrawalCooldownActive: boolean
  /** Ada pengajuan penarikan yang masih diproses admin. */
  withdrawalProcessing: boolean
}

/** Alasan pembelian ditolak, atau `null` kalau boleh jalan.
 *
 * Urutannya bukan selera. Saldo diperiksa lebih dulu karena itu yang paling sering jadi
 * jawabannya, lalu penolakan yang khusus per barang.
 *
 * `pool_empty` ada karena pelajaran yang sudah dibayar Arena: menyuruh orang membayar demi hasil
 * yang sudah pasti nol adalah cara tercepat membuat sebuah fitur dibenci. Energi yang dibeli saat
 * stok reward habis tidak membeli apa-apa — soalnya tetap bisa dikerjakan, tapi tidak membayar
 * satu credit pun. Jadi penolakannya di depan, sebelum TD-nya terbakar, bukan sesudah. Pass Gaspol
 * dijaga hal yang sama: jendela yang jalan di atas stok kosong adalah jendela yang habis tanpa
 * membayar apa pun.
 *
 * `energy_full` mengikuti `claimMission`: hadiah yang tidak muat utuh dijepit `applyEnergyGrant`
 * tanpa jejak, jadi user membayar penuh untuk sebagian. Lebih baik ditolak.
 *
 * `no_cooldown` dan `withdrawal_processing` adalah bentuk yang sama untuk Tarik Sekarang: melepas
 * jeda yang sedang tidak menahan apa-apa berarti membayar untuk yang sudah gratis, dan pengajuan
 * yang masih diproses tetap menahan pengajuan berikutnya lewat `withdrawals_one_active_per_user` —
 * jadi jatah yang dibeli di situ hangus sebelum sempat dipakai. */
export function storePurchaseRefusal(
  item: StoreItem,
  state: StorePurchaseState,
  payment: StorePayment = 'credits',
): StorePurchaseRefusal | null {
  if (!storeEnabled()) return 'store_disabled'

  const price = storePrice(item, payment)
  if (price === null) return 'payment_unavailable'
  if (payment === 'credits' && state.balance < price) return 'insufficient_balance'

  if (item.effect.kind === 'energy') {
    if (state.energy + item.effect.amount > state.maxEnergy) return 'energy_full'
    if (state.rewardPoolCredits <= 0) return 'pool_empty'
  }

  if (item.effect.kind === 'gaspol' && state.rewardPoolCredits <= 0) return 'pool_empty'

  if (item.effect.kind === 'withdraw_skip') {
    if (state.withdrawalProcessing) return 'withdrawal_processing'
    if (!state.withdrawalCooldownActive) return 'no_cooldown'
  }

  if (item.effect.kind === 'cosmetic' && state.ownedCosmetics.includes(item.effect.cosmetic)) {
    return 'already_owned'
  }

  return null
}

/** Apakah sebuah key kosmetik boleh dipasang oleh user yang memiliki daftar ini. Dipakai jalur
 * pasang di server dan tombol di klien, satu aturan untuk keduanya. `null` selalu boleh: itu
 * "lepas yang sedang dipakai". */
export function canEquip(key: unknown, owned: readonly CosmeticKey[]): boolean {
  if (key === null) return true
  if (!isCosmeticKey(key)) return false
  return owned.includes(key)
}
