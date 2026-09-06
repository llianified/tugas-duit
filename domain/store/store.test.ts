import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '../economy/economy-config'
import type { CosmeticKey } from './cosmetics'
import {
  findStoreItem,
  fulfilmentCatalog,
  isStoreItemKey,
  STORE_ITEM_KEYS,
  storeCatalog,
  storeEnabled,
  storeItem,
  storePrice,
  storePurchaseRefusal,
} from './store'

const pakai = (patch: Partial<typeof DEFAULT_ECONOMY_CONFIG>) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

const keadaan = (patch: Partial<Parameters<typeof storePurchaseRefusal>[1]> = {}) => ({
  balance: 1_000,
  energy: 0,
  maxEnergy: 5,
  rewardPoolCredits: 30,
  ownedCosmetics: [] as CosmeticKey[],
  withdrawalCooldownActive: true,
  withdrawalProcessing: false,
  ...patch,
})

describe('katalog toko', () => {
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('menerbitkan setiap kunci yang dikenal, tidak lebih', () => {
    expect(storeCatalog().map((item) => item.key)).toEqual([...STORE_ITEM_KEYS])
    for (const key of STORE_ITEM_KEYS) expect(isStoreItemKey(key)).toBe(true)
    expect(isStoreItemKey('bingkai_ngawur')).toBe(false)
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

/** TOKO-5 — rak yang melebar tetap tunduk pada aturan yang sama.
 *
 * Empat barang baru masuk di migrasi 0058, dan tiga di antaranya bisa dibayar dua cara. Yang
 * diperiksa di sini bukan bahwa mereka ada, melainkan bahwa masing-masing tetap menolak lebih dulu
 * daripada mengambil bayaran untuk hasil yang sudah pasti nol — dan bahwa jalur tunai menolak
 * dengan alasan yang persis sama dengan jalur TD. */
describe('TOKO-5 — barang baru dan dua cara bayar', () => {
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('memberi Pass Gaspol dan Tarik Sekarang dua harga, energi dan premium hanya harga TD', () => {
    expect(storePrice(storeItem('gaspol_pass'), 'cash')).toBe(
      DEFAULT_ECONOMY_CONFIG.storeGaspolPriceIdr,
    )
    expect(storePrice(storeItem('withdraw_skip'), 'cash')).toBe(
      DEFAULT_ECONOMY_CONFIG.storeWithdrawSkipPriceIdr,
    )
    expect(storePrice(storeItem('energy_refill'), 'cash')).toBeNull()
    expect(storePrice(storeItem('premium_month'), 'cash')).toBeNull()
  })

  it('menolak cara bayar yang memang tidak dijual, bukan diam-diam memakai harga yang lain', () => {
    expect(storePurchaseRefusal(storeItem('premium_month'), keadaan(), 'cash')).toBe(
      'payment_unavailable',
    )
  })

  /** Jalur tunai tidak memeriksa saldo TD sama sekali — memeriksanya berarti menolak user yang
   * justru membayar karena saldonya belum cukup. */
  it('tidak mengikat pembayaran QRIS pada saldo TD', () => {
    const miskin = keadaan({ balance: 0 })
    expect(storePurchaseRefusal(storeItem('gaspol_pass'), miskin, 'credits')).toBe(
      'insufficient_balance',
    )
    expect(storePurchaseRefusal(storeItem('gaspol_pass'), miskin, 'cash')).toBeNull()
  })

  /** Alasan yang sama dengan energi: jendela yang jalan di atas stok kosong adalah jendela yang
   * habis tanpa membayar satu credit pun. */
  it('menolak Pass Gaspol saat stok reward habis, lewat cara bayar mana pun', () => {
    const kosong = keadaan({ rewardPoolCredits: 0 })
    expect(storePurchaseRefusal(storeItem('gaspol_pass'), kosong, 'credits')).toBe('pool_empty')
    expect(storePurchaseRefusal(storeItem('gaspol_pass'), kosong, 'cash')).toBe('pool_empty')
  })

  it('menolak Tarik Sekarang saat tidak ada jeda yang menahan', () => {
    expect(
      storePurchaseRefusal(storeItem('withdraw_skip'), keadaan({ withdrawalCooldownActive: false })),
    ).toBe('no_cooldown')
  })

  /** Pengajuan yang masih diproses tetap menahan pengajuan berikutnya lewat
   * `withdrawals_one_active_per_user`, jadi jatah yang dibeli di situ hangus sebelum dipakai. */
  it('menolak Tarik Sekarang saat pengajuan sebelumnya masih diproses', () => {
    expect(
      storePurchaseRefusal(storeItem('withdraw_skip'), keadaan({ withdrawalProcessing: true })),
    ).toBe('withdrawal_processing')
  })

  /** Kosmetik satu-satunya barang yang TIDAK punya harga TD: ia tidak menyentuh ekonomi, jadi
   * menjualnya lewat saldo menukar liabilitas dengan sesuatu yang seharusnya pemasukan bersih. */
  it('cuma menjual kosmetik lewat QRIS, tidak pernah lewat saldo', () => {
    expect(storePrice(storeItem('frame_emas'), 'credits')).toBeNull()
    expect(storePrice(storeItem('frame_emas'), 'cash')).toBe(
      DEFAULT_ECONOMY_CONFIG.storeFramePriceIdr,
    )
    expect(storePrice(storeItem('title_sultan'), 'cash')).toBe(
      DEFAULT_ECONOMY_CONFIG.storeTitlePriceIdr,
    )
    expect(storePurchaseRefusal(storeItem('frame_emas'), keadaan(), 'credits')).toBe(
      'payment_unavailable',
    )
  })

  it('menolak kosmetik yang sudah dimiliki', () => {
    expect(storePurchaseRefusal(storeItem('frame_emas'), keadaan(), 'cash')).toBeNull()
    expect(
      storePurchaseRefusal(storeItem('frame_emas'), keadaan({ ownedCosmetics: ['frame_emas'] }), 'cash'),
    ).toBe('already_owned')
  })

  it('menyembunyikan rak kosmetik saat saklarnya dimatikan', () => {
    pakai({ storeCosmeticsEnabled: 0 })
    expect(storeCatalog().some((item) => item.section === 'cosmetic')).toBe(false)
    expect(findStoreItem('frame_emas')).toBeNull()
  })

  /** Saklar tampilan tidak boleh berubah jadi saklar yang menelan pembayaran orang: pesanan QRIS
   * yang terbit sebelum raknya ditutup tetap harus bisa diserahkan. */
  it('tetap bisa menyerahkan kosmetik yang sudah dibayar meski raknya ditutup', () => {
    pakai({ storeCosmeticsEnabled: 0 })
    expect(fulfilmentCatalog().some((item) => item.key === 'frame_emas')).toBe(true)
  })
})
