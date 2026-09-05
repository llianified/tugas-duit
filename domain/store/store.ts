/** Toko TD: aturan murni, tanpa I/O. Satu-satunya permukaan di app ini yang MENGURANGI saldo user
 * tanpa menariknya jadi Rupiah.
 *
 * Arahnya sengaja kebalikan dari seluruh repo. Misi, Arena, dan komisi menambah liabilitas; toko
 * menghapusnya. TD yang dibelanjakan di sini hilang dari neraca dan tidak pernah kembali sebagai
 * penarikan — itu gunanya, bukan efek sampingnya.
 *
 * Isi raknya dijaga satu aturan: barang yang dijual tidak boleh menambah plafon payout. Energi
 * lolos karena kolam reward tetap mematok berapa credit yang bisa keluar — energi hanya mengubah
 * SECEPAT apa user sampai ke plafonnya, bukan seberapa tinggi plafonnya. Premium lolos karena yang
 * dibeli adalah langganan yang selama ini dibayar tunai. Barang yang menaikkan plafon tidak punya
 * tempat di sini. */

import { economyConfig } from '@/domain/economy/economy-config'
import type { PremiumMonths } from '@/domain/economy/premium'

export type StoreItemKey = 'energy_refill' | 'premium_month'

export const STORE_ITEM_KEYS: readonly StoreItemKey[] = ['energy_refill', 'premium_month']

export type StoreItemEffect =
  | { kind: 'energy'; amount: number }
  | { kind: 'premium'; months: PremiumMonths }

export interface StoreItem {
  key: StoreItemKey
  title: string
  detail: string
  priceCredits: number
  effect: StoreItemEffect
}

export function storeEnabled(): boolean {
  return economyConfig().storeEnabled > 0
}

export function storeCatalog(): StoreItem[] {
  const config = economyConfig()
  return [
    {
      key: 'energy_refill',
      title: `Tambah ${config.storeEnergyAmount} energi`,
      detail: 'Langsung masuk, nggak perlu nunggu isi ulang.',
      priceCredits: config.storeEnergyPriceCredits,
      effect: { kind: 'energy', amount: config.storeEnergyAmount },
    },
    {
      key: 'premium_month',
      title: 'Premium 1 bulan',
      detail: 'Manfaatnya sama persis dengan premium yang dibeli pakai QRIS.',
      priceCredits: config.storePremiumMonthPriceCredits,
      effect: { kind: 'premium', months: 1 },
    },
  ]
}

export function storeItem(key: StoreItemKey): StoreItem {
  const found = storeCatalog().find((item) => item.key === key)
  if (!found) throw new Error(`Barang toko tidak dikenal: ${key}`)
  return found
}

export function isStoreItemKey(value: unknown): value is StoreItemKey {
  return typeof value === 'string' && STORE_ITEM_KEYS.includes(value as StoreItemKey)
}

export type StorePurchaseRefusal =
  | 'store_disabled'
  | 'unknown_item'
  | 'insufficient_balance'
  | 'energy_full'
  | 'pool_empty'

export interface StorePurchaseState {
  balance: number
  /** Energi yang sudah diproyeksikan ke sekarang, bukan angka mentah dari kolom. */
  energy: number
  maxEnergy: number
  /** Sisa stok kolam reward. Ikut diperiksa untuk energi — lihat alasannya di bawah. */
  rewardPoolCredits: number
}

/** Alasan pembelian ditolak, atau `null` kalau boleh jalan.
 *
 * Urutannya bukan selera. Saldo diperiksa lebih dulu karena itu yang paling sering jadi
 * jawabannya, lalu penolakan yang khusus per barang.
 *
 * `pool_empty` ada karena pelajaran yang sudah dibayar Arena: menyuruh orang membayar demi hasil
 * yang sudah pasti nol adalah cara tercepat membuat sebuah fitur dibenci. Energi yang dibeli saat
 * stok reward habis tidak membeli apa-apa — soalnya tetap bisa dikerjakan, tapi tidak membayar
 * satu credit pun. Jadi penolakannya di depan, sebelum TD-nya terbakar, bukan sesudah.
 *
 * `energy_full` mengikuti `claimMission`: hadiah yang tidak muat utuh dijepit `applyEnergyGrant`
 * tanpa jejak, jadi user membayar penuh untuk sebagian. Lebih baik ditolak. */
export function storePurchaseRefusal(
  item: StoreItem,
  state: StorePurchaseState,
): StorePurchaseRefusal | null {
  if (!storeEnabled()) return 'store_disabled'
  if (state.balance < item.priceCredits) return 'insufficient_balance'

  if (item.effect.kind === 'energy') {
    if (state.energy + item.effect.amount > state.maxEnergy) return 'energy_full'
    if (state.rewardPoolCredits <= 0) return 'pool_empty'
  }

  return null
}
