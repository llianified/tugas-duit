import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

async function makeUser(options: { balance?: number; energy?: number; pool?: number } = {}) {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits,energy,energy_updated_at,reward_pool,reward_pool_updated_at)
     values($1,'Uji Toko',$2,$3,$4,now(),$5,now()) returning id`,
    [
      String(910_000_000_000_000 + suffix),
      generateReferralCode(),
      options.balance ?? 1_000,
      options.energy ?? 0,
      options.pool ?? 30,
    ],
  )
  return Number(rows[0].id)
}

const readUser = async (userId: number) => {
  const { query } = await import('../platform/db')
  const rows = await query<{ balance_credits: string; energy: number; premium_until: Date | null }>(
    'select balance_credits, energy, premium_until from users where id=$1',
    [userId],
  )
  return rows[0]
}

/** TOKO-2 — belanja memotong saldo tepat sekali, dan barangnya diberikan tepat sekali.
 *
 * Toko adalah satu-satunya jalur yang MENGURANGI saldo tanpa membayarkannya sebagai Rupiah, jadi
 * yang dijaga di sini bukan kenyamanan: TD yang terpotong tanpa barangnya sampai, atau barang yang
 * sampai tanpa TD terpotong, dua-duanya kerugian yang tidak terlihat di layar mana pun. */
describe('TOKO-2 — pemotongan saldo dan pemberian barang', () => {
  it('memotong harga persis dan mencatat ledger purchase bertanda negatif', async () => {
    const { buyStoreItem } = await import('./store')
    const { query } = await import('../platform/db')
    const userId = await makeUser({ balance: 100, energy: 0, pool: 30 })

    const result = await buyStoreItem(userId, 'energy_refill', crypto.randomUUID())
    expect(result).toMatchObject({ ok: true, replayed: false, itemKey: 'energy_refill' })

    const after = await readUser(userId)
    expect(Number(after.balance_credits)).toBe(100 - DEFAULT_ECONOMY_CONFIG.storeEnergyPriceCredits)
    expect(Number(after.energy)).toBe(DEFAULT_ECONOMY_CONFIG.storeEnergyAmount)

    const ledger = await query<{ kind: string; amount: string; reference_id: string }>(
      `select kind, amount, reference_id from credit_ledger where user_id=$1`,
      [userId],
    )
    expect(ledger).toHaveLength(1)
    expect(ledger[0].kind).toBe('purchase')
    expect(Number(ledger[0].amount)).toBe(-DEFAULT_ECONOMY_CONFIG.storeEnergyPriceCredits)
    expect(ledger[0].reference_id).toBe('energy_refill')
  })

  /** Inti idempotensinya. `appendLedger` sendiri sudah menolak kunci yang berulang — tapi ia
   * kembali LEBIH AWAL tanpa memotong, sementara pemberian barangnya ada di luar sana. Tanpa
   * penjagaan di `buyStoreItem`, tap ganda dibayar sekali dan diterima dua kali. */
  it('tap ganda dengan requestId yang sama dibayar sekali dan diterima sekali', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 100, energy: 0, pool: 30 })
    const requestId = crypto.randomUUID()

    const pertama = await buyStoreItem(userId, 'energy_refill', requestId)
    const kedua = await buyStoreItem(userId, 'energy_refill', requestId)

    expect(pertama).toMatchObject({ ok: true, replayed: false })
    expect(kedua).toMatchObject({ ok: true, replayed: true })

    const after = await readUser(userId)
    expect(Number(after.balance_credits)).toBe(100 - DEFAULT_ECONOMY_CONFIG.storeEnergyPriceCredits)
    expect(Number(after.energy)).toBe(DEFAULT_ECONOMY_CONFIG.storeEnergyAmount)
  })

  /** Sengaja memakai premium, bukan energi: pembelian energi kedua berturut-turut memang DITOLAK
   * `energy_full` karena isinya tidak muat utuh di kapasitas — perilaku yang diuji terpisah di
   * TOKO-1. Yang dijaga di sini cuma bahwa idempotensi terikat pada requestId, bukan pada barang. */
  it('requestId berbeda memang membeli dua kali', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 10_000, energy: 0, pool: 0 })

    await buyStoreItem(userId, 'premium_month', crypto.randomUUID())
    await buyStoreItem(userId, 'premium_month', crypto.randomUUID())

    const after = await readUser(userId)
    expect(Number(after.balance_credits)).toBe(
      10_000 - DEFAULT_ECONOMY_CONFIG.storePremiumMonthPriceCredits * 2,
    )
  })

  it('menolak saldo kurang tanpa menyentuh apa pun', async () => {
    const { buyStoreItem } = await import('./store')
    const { query } = await import('../platform/db')
    const userId = await makeUser({ balance: 1, energy: 0, pool: 30 })

    expect(await buyStoreItem(userId, 'energy_refill', crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'insufficient_balance',
    })

    const after = await readUser(userId)
    expect(Number(after.balance_credits)).toBe(1)
    expect(Number(after.energy)).toBe(0)
    expect(await query('select 1 from credit_ledger where user_id=$1', [userId])).toHaveLength(0)
  })

  it('menolak energi saat stok reward habis, sebelum TD terbakar', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 100, energy: 0, pool: 0 })

    expect(await buyStoreItem(userId, 'energy_refill', crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'pool_empty',
    })
    expect(Number((await readUser(userId)).balance_credits)).toBe(100)
  })

  it('menolak energi yang tidak muat utuh', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 100, energy: 5, pool: 30 })

    expect(await buyStoreItem(userId, 'energy_refill', crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'energy_full',
    })
    expect(Number((await readUser(userId)).balance_credits)).toBe(100)
  })

  it('premium yang dibeli pakai TD benar-benar menyalakan premium', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 10_000, energy: 0, pool: 0 })

    const result = await buyStoreItem(userId, 'premium_month', crypto.randomUUID())
    expect(result).toMatchObject({ ok: true, itemKey: 'premium_month' })

    const after = await readUser(userId)
    expect(after.premium_until).not.toBeNull()
    expect(after.premium_until!.getTime()).toBeGreaterThan(Date.now())
    expect(Number(after.balance_credits)).toBe(
      10_000 - DEFAULT_ECONOMY_CONFIG.storePremiumMonthPriceCredits,
    )
  })

  it('menolak kunci barang yang tidak dikenal', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser()

    expect(await buyStoreItem(userId, 'bingkai_ngawur', crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'unknown_item',
    })
  })
})

/** TOKO-3 — barang berbayar baru: yang dibeli benar-benar berlaku, dan berlakunya menumpuk.
 *
 * Ketiganya menyentuh kolom `users` yang tidak pernah muncul di ledger, jadi kekeliruan di sini
 * tidak akan tertangkap rekonsiliasi saldo — yang terlihat cuma user yang membayar lalu tidak
 * mendapat apa-apa. */
describe('TOKO-3 — Pass Gaspol dan Tarik Sekarang', () => {
  const readExtras = async (userId: number) => {
    const { query } = await import('../platform/db')
    const rows = await query<{
      gaspol_until: Date | null
      withdrawal_cooldown_waived_at: Date | null
      now: Date
    }>(
      'select gaspol_until, withdrawal_cooldown_waived_at, now() as now from users where id=$1',
      [userId],
    )
    return rows[0]
  }

  it('menyalakan jendela Gaspol, dan pembelian kedua menumpuk dari sisanya', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 1_000, pool: 30 })

    expect(await buyStoreItem(userId, 'gaspol_pass', crypto.randomUUID())).toMatchObject({
      ok: true,
    })
    const pertama = await readExtras(userId)
    expect(pertama.gaspol_until).not.toBeNull()

    await buyStoreItem(userId, 'gaspol_pass', crypto.randomUUID())
    const kedua = await readExtras(userId)

    /** Menumpuk, bukan menggantikan: tanpa `greatest(now(), coalesce(...))` pembelian kedua justru
     * MEMOTONG sisa yang masih berjalan, dan yang terlihat user cuma jam yang tiba-tiba pendek. */
    const selisihMenit =
      ((kedua.gaspol_until as Date).getTime() - (pertama.gaspol_until as Date).getTime()) / 60_000
    expect(Math.round(selisihMenit)).toBe(DEFAULT_ECONOMY_CONFIG.storeGaspolMinutes)
  })

  it('menolak Gaspol saat stok reward habis, sebelum TD-nya terbakar', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 1_000, pool: 0 })

    expect(await buyStoreItem(userId, 'gaspol_pass', crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'pool_empty',
    })
    expect(Number((await readUser(userId)).balance_credits)).toBe(1_000)
  })

  /** Tanpa jeda yang menahan, Tarik Sekarang tidak membeli apa pun — dan menjualnya di situ adalah
   * cara tercepat membuat barang berbayar dibenci. */
  it('menolak Tarik Sekarang saat tidak ada jeda penarikan yang berjalan', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 1_000 })

    expect(await buyStoreItem(userId, 'withdraw_skip', crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'no_cooldown',
    })
  })
})

/** TOKO-4 — kepemilikan kosmetik: dibeli sekali, dipakai sesuka hati, tidak bisa dipasang tanpa
 * dibeli. Yang dipasang tampil di papan peringkat — satu-satunya permukaan publik aplikasi ini —
 * jadi penjagaannya di server, bukan di tombol. */
describe('TOKO-4 — kepemilikan dan pemasangan kosmetik', () => {
  it('mencatat kepemilikan lalu langsung memasangnya', async () => {
    const { buyStoreItem } = await import('./store')
    const { query } = await import('../platform/db')
    const userId = await makeUser({ balance: 1_000 })

    expect(await buyStoreItem(userId, 'frame_emas', crypto.randomUUID())).toMatchObject({ ok: true })

    const owned = await query<{ cosmetic_key: string }>(
      'select cosmetic_key from user_cosmetics where user_id=$1',
      [userId],
    )
    expect(owned.map((row) => row.cosmetic_key)).toEqual(['frame_emas'])

    const equipped = await query<{ equipped_frame: string | null }>(
      'select equipped_frame from users where id=$1',
      [userId],
    )
    expect(equipped[0].equipped_frame).toBe('frame_emas')
  })

  it('menolak pembelian kedua untuk barang yang sudah dimiliki', async () => {
    const { buyStoreItem } = await import('./store')
    const userId = await makeUser({ balance: 1_000 })

    await buyStoreItem(userId, 'title_sultan', crypto.randomUUID())
    expect(await buyStoreItem(userId, 'title_sultan', crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'already_owned',
    })
  })

  it('menolak pemasangan barang yang belum dibeli', async () => {
    const { equipCosmetic } = await import('./store')
    const userId = await makeUser({ balance: 0 })

    expect(await equipCosmetic(userId, 'frame', 'frame_api')).toEqual({
      ok: false,
      reason: 'not_owned',
    })
  })

  /** Gelar yang dipasang ke slot bingkai lolos pemeriksaan kepemilikan tapi tidak akan pernah
   * tergambar — penolakan yang harus terjadi di server, bukan diserahkan ke penyaji. */
  it('menolak kosmetik yang jenisnya tidak cocok dengan slotnya', async () => {
    const { buyStoreItem, equipCosmetic } = await import('./store')
    const userId = await makeUser({ balance: 1_000 })

    await buyStoreItem(userId, 'title_kilat', crypto.randomUUID())
    expect(await equipCosmetic(userId, 'frame', 'title_kilat')).toEqual({
      ok: false,
      reason: 'unknown_slot',
    })
  })

  it('melepas yang sedang dipakai tanpa menghapus kepemilikannya', async () => {
    const { buyStoreItem, equipCosmetic } = await import('./store')
    const { query } = await import('../platform/db')
    const userId = await makeUser({ balance: 1_000 })

    await buyStoreItem(userId, 'frame_langit', crypto.randomUUID())
    expect(await equipCosmetic(userId, 'frame', null)).toEqual({
      ok: true,
      equipped: { frame: null, title: null },
    })

    const owned = await query('select 1 from user_cosmetics where user_id=$1', [userId])
    expect(owned).toHaveLength(1)
  })
})
