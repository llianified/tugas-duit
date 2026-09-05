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

    expect(await buyStoreItem(userId, 'frame_emas', crypto.randomUUID())).toEqual({
      ok: false,
      reason: 'unknown_item',
    })
  })
})
