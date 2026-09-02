import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  process.env.NEXT_PUBLIC_MONETAG_ZONE_ID = 'uji-block'
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

async function makeUser(): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,energy)
     values($1,'Uji Premium',$2,5) returning id`,
    [900_000_000_000_000 + suffix, generateReferralCode()],
  )
  return Number(rows[0].id)
}

async function makeInvoice(userId: number, months: number, signature: string): Promise<string> {
  const { query } = await import('../platform/db')
  const orderId = `TD-TEST-${userId}-${months}-${Math.floor(Math.random() * 1_000_000)}`
  await query(
    `insert into premium_payments(user_id,order_id,months,amount_idr,total_amount_idr,signature,expires_at)
     values($1,$2,$3,19900,19916,$4,now()+interval '1 hour')`,
    [userId, orderId, months, signature],
  )
  return orderId
}

const readPremiumUntil = async (userId: number) => {
  const { query } = await import('../platform/db')
  const rows = await query<{ premium_until: Date | null }>(
    'select premium_until from users where id=$1',
    [userId],
  )
  return rows[0].premium_until
}

describe('PREM-DB-1 — pembayaran menyalakan premium sekali saja', () => {
  it('menyalakan premium, dan webhook kedua tidak memperpanjang lagi', async () => {
    const { settlePremiumPayment } = await import('./premium-payment')
    const userId = await makeUser()
    const orderId = await makeInvoice(userId, 1, 'tanda-tangan-asli')

    const first = await settlePremiumPayment(orderId, 'tanda-tangan-asli', 'webhook')
    expect(first.settled).toBe(true)
    const afterFirst = await readPremiumUntil(userId)
    expect(afterFirst).not.toBeNull()

    const second = await settlePremiumPayment(orderId, 'tanda-tangan-asli', 'webhook')
    expect(second).toEqual({ settled: false, reason: 'already_settled' })
    expect((await readPremiumUntil(userId))?.getTime()).toBe(afterFirst?.getTime())
  })

  it('menolak signature yang tidak cocok tanpa menyentuh masa aktif', async () => {
    const { settlePremiumPayment } = await import('./premium-payment')
    const userId = await makeUser()
    const orderId = await makeInvoice(userId, 3, 'tanda-tangan-asli')

    const settled = await settlePremiumPayment(orderId, 'tanda-tangan-palsu', 'webhook')
    expect(settled).toEqual({ settled: false, reason: 'bad_signature' })
    expect(await readPremiumUntil(userId)).toBeNull()

    const kosong = await settlePremiumPayment(orderId, null, 'webhook')
    expect(kosong).toEqual({ settled: false, reason: 'bad_signature' })
    expect(await readPremiumUntil(userId)).toBeNull()
  })

  it('mengabaikan order yang tidak dikenal', async () => {
    const { settlePremiumPayment } = await import('./premium-payment')
    expect(await settlePremiumPayment('TD-TIDAK-ADA', 'apa-saja', 'webhook')).toEqual({
      settled: false,
      reason: 'not_found',
    })
  })
})

describe('PREM-DB-2 — perpanjangan menumpuk dari tanggal berakhir', () => {
  it('menambah dari sisa yang masih berlaku, bukan dari sekarang', async () => {
    const { query, transaction } = await import('../platform/db')
    const { grantPremium } = await import('./premium')
    const userId = await makeUser()

    await transaction((tx) => grantPremium(tx, userId, 1))
    const afterFirst = await readPremiumUntil(userId)

    await transaction((tx) => grantPremium(tx, userId, 2))
    const afterSecond = await readPremiumUntil(userId)

    const expected = await query<{ expected: Date }>(
      "select ($1::timestamptz + interval '2 month') as expected",
      [afterFirst],
    )
    expect(afterSecond?.getTime()).toBe(expected[0].expected.getTime())
  })

  it('menghitung dari sekarang kalau langganannya sudah lewat', async () => {
    const { query, transaction } = await import('../platform/db')
    const { grantPremium } = await import('./premium')
    const userId = await makeUser()

    await query("update users set premium_until=now()-interval '10 days' where id=$1", [userId])
    await transaction((tx) => grantPremium(tx, userId, 1))

    const until = await readPremiumUntil(userId)
    expect(until!.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('PREM-DB-3 — status premium menggerakkan batas yang dibaca server', () => {
  it('memperbesar kapasitas kolam dan energi, dan mematikan interstitial otomatis saja', async () => {
    const { query } = await import('../platform/db')
    const { readAdsState } = await import('../ads/ads')
    const { readEnergy } = await import('../economy/energy')
    const { readRewardPoolCapacity } = await import('../economy/reward-pool')
    const userId = await makeUser()

    const kapasitasBiasa = await readRewardPoolCapacity(userId)
    const energiBiasa = await readEnergy(userId)
    const biasa = await readAdsState(userId)
    expect(biasa.enabled).toBe(true)
    expect(biasa.inAppEnabled).toBe(true)

    await query("update users set premium_until=now()+interval '30 days' where id=$1", [userId])

    expect(await readRewardPoolCapacity(userId)).toBe(
      kapasitasBiasa + DEFAULT_ECONOMY_CONFIG.premiumPoolCapBonus,
    )
    expect((await readEnergy(userId)).max).toBe(DEFAULT_ECONOMY_CONFIG.premiumMaxEnergy)
    expect((await readEnergy(userId)).max).toBeGreaterThan(energiBiasa.max)

    /** Inti pemisahannya: premium hanya membayar untuk tidak diganggu. Interstitial yang nongol sendiri mati, tapi tiket berhadiah tetap boleh dibuka — itu jalan keluar saat energinya habis, dan impresinya tetap masuk sebagai pemasukan. */
    const premium = await readAdsState(userId)
    expect(premium.inAppEnabled).toBe(false)
    expect(premium.enabled).toBe(true)
    const { openAdTicket } = await import('../ads/ads')
    await expect(openAdTicket(userId)).resolves.toMatchObject({ ok: true })
  })

  it('AUDIT-H1 — melunasi tagihan yang telanjur ditandai kedaluwarsa', async () => {
    const { query } = await import('../platform/db')
    const { settlePremiumPayment } = await import('./premium-payment')
    const userId = await makeUser()
    const orderId = await makeInvoice(userId, 1, 'sig-kedaluwarsa')

    /** `expires_at` kita dihitung dari jam proses sendiri dan sengaja jatuh lebih awal daripada kedaluwarsa milik gateway, jadi ada jendela nyata ketika user membayar tagihan yang sudah kita tandai `expired`. Bentuk lamanya menuntut `state='pending'` pada update terakhir, sehingga pembayaran di jendela itu melempar PAYMENT_STATE_RACE, transaksinya rollback, dan webhook menjawab 500 selamanya: uang masuk, premium tidak pernah menyala. */
    await query(
      "update premium_payments set state='expired', updated_at=now() where order_id=$1",
      [orderId],
    )

    const settled = await settlePremiumPayment(orderId, 'sig-kedaluwarsa', 'webhook', 19916)

    expect(settled.settled).toBe(true)
    expect(await readPremiumUntil(userId)).not.toBeNull()

    const row = await query<{ state: string; granted_until: Date | null }>(
      'select state, granted_until from premium_payments where order_id=$1',
      [orderId],
    )
    expect(row[0].state).toBe('paid')
    expect(row[0].granted_until).not.toBeNull()
  })

  it('AUDIT-H1 — tetap menolak pelunasan kedua atas tagihan yang sudah lunas', async () => {
    const { settlePremiumPayment } = await import('./premium-payment')
    const userId = await makeUser()
    const orderId = await makeInvoice(userId, 1, 'sig-sekali')

    expect((await settlePremiumPayment(orderId, 'sig-sekali', 'webhook', 19916)).settled).toBe(true)
    const first = await readPremiumUntil(userId)

    const again = await settlePremiumPayment(orderId, 'sig-sekali', 'webhook', 19916)
    expect(again).toEqual({ settled: false, reason: 'already_settled' })
    expect(await readPremiumUntil(userId)).toEqual(first)
  })

  it('memakai batas task harian premium di consumeQuota', async () => {
    const { query, transaction } = await import('../platform/db')
    const { consumeQuota } = await import('../economy/quota')
    const userId = await makeUser()
    setActiveEconomyConfig({
      ...DEFAULT_ECONOMY_CONFIG,
      maxTasksPerDay: 2,
      premiumMaxTasksPerDay: 4,
    })

    await query("update users set premium_until=now()+interval '30 days' where id=$1", [userId])
    await transaction(async (tx) => {
      for (let index = 0; index < 4; index += 1) {
        expect((await consumeQuota(tx, userId, 1)).refusal).toBeNull()
      }
      expect((await consumeQuota(tx, userId, 1)).refusal).toBe('daily_task_cap')
    })
  })
})
