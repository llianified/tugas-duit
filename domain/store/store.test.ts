import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '../economy/economy-config'
import {
  isStoreItemKey,
  STORE_ITEM_KEYS,
  storeCatalog,
  storeEnabled,
  storeItem,
  storePurchaseRefusal,
} from './store'

const pakai = (patch: Partial<typeof DEFAULT_ECONOMY_CONFIG>) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

const keadaan = (patch: Partial<Parameters<typeof storePurchaseRefusal>[1]> = {}) => ({
  balance: 1_000,
  energy: 0,
  maxEnergy: 5,
  rewardPoolCredits: 30,
  ...patch,
})

describe('katalog toko', () => {
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('menerbitkan setiap kunci yang dikenal, tidak lebih', () => {
    expect(storeCatalog().map((item) => item.key)).toEqual([...STORE_ITEM_KEYS])
    for (const key of STORE_ITEM_KEYS) expect(isStoreItemKey(key)).toBe(true)
    expect(isStoreItemKey('frame_emas')).toBe(false)
  })

  it('mengambil harga dan isi dari konfigurasi, bukan dari angka di kode', () => {
    pakai({ storeEnergyPriceCredits: 44, storeEnergyAmount: 2, storePremiumMonthPriceCredits: 777 })

    expect(storeItem('energy_refill').priceCredits).toBe(44)
    expect(storeItem('energy_refill').effect).toEqual({ kind: 'energy', amount: 2 })
    expect(storeItem('premium_month').priceCredits).toBe(777)
  })

  it('ikut tertutup saat saklarnya dimatikan', () => {
    pakai({ storeEnabled: 0 })
    expect(storeEnabled()).toBe(false)
    expect(storePurchaseRefusal(storeItem('energy_refill'), keadaan())).toBe('store_disabled')
  })
})

/** TOKO-1 — belanja tidak pernah membakar TD untuk hasil yang sudah pasti nol.
 *
 * Ketiga penolakan di bawah punya sebab yang sama: user membayar penuh untuk sesuatu yang tidak
 * utuh diterima. Itu bentuk kegagalan yang paling cepat membuat sebuah fitur dibenci, dan repo ini
 * sudah membayarnya dua kali — `hasWinnablePrize` di Arena dan `energy_full` di `claimMission`. */
describe('TOKO-1 — penolakan sebelum TD terbakar, bukan sesudah', () => {
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('mengizinkan pembelian yang wajar', () => {
    expect(storePurchaseRefusal(storeItem('energy_refill'), keadaan())).toBeNull()
    expect(storePurchaseRefusal(storeItem('premium_month'), keadaan())).toBeNull()
  })

  it('menolak saldo yang kurang, dan itu diperiksa paling dulu', () => {
    const miskin = keadaan({ balance: 0, energy: 5, rewardPoolCredits: 0 })
    expect(storePurchaseRefusal(storeItem('energy_refill'), miskin)).toBe('insufficient_balance')
  })

  it('menolak energi yang tidak muat utuh, bukan menjepitnya diam-diam', () => {
    pakai({ storeEnergyAmount: 3 })
    expect(storePurchaseRefusal(storeItem('energy_refill'), keadaan({ energy: 3 }))).toBe('energy_full')
    expect(storePurchaseRefusal(storeItem('energy_refill'), keadaan({ energy: 2 }))).toBeNull()
  })

  /** Energi yang dibeli saat stok reward habis tidak membeli apa-apa: soalnya tetap bisa
   * dikerjakan, tapi tidak membayar satu credit pun. */
  it('menolak energi saat stok reward habis', () => {
    expect(storePurchaseRefusal(storeItem('energy_refill'), keadaan({ rewardPoolCredits: 0 }))).toBe('pool_empty')
  })

  /** Premium tidak bergantung pada stok maupun energi — menolaknya karena kolam kosong justru
   * menutup barang yang paling masuk akal dibeli saat stoknya habis. */
  it('tidak mengikat premium pada stok reward maupun kapasitas energi', () => {
    const mentok = keadaan({ energy: 5, rewardPoolCredits: 0 })
    expect(storePurchaseRefusal(storeItem('premium_month'), mentok)).toBeNull()
  })
})
