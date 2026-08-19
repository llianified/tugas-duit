import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { dailyCommissionCreditCap } from '@/domain/economy'
import {
  DEFAULT_ECONOMY_CONFIG,
  setActiveEconomyConfig,
} from '@/domain/economy-config'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

async function makeUser(balance = 0): Promise<number> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits)
     values($1,$2,$3,$4) returning id`,
    [800_000_000_000_000 + suffix, 'Uji', generateReferralCode(), balance],
  )
  return Number(rows[0].id)
}

describe('ECON-2 — plafon komisi referral harian', () => {
  it('menurunkan plafon dari nilai Rupiah di domain economy', () => {
    expect(dailyCommissionCreditCap()).toBe(60)
  })

  it('membayar penuh selama masih di bawah plafon', async () => {
    const { transaction } = await import('./db')
    const { consumeCommissionQuota } = await import('./quota')
    const userId = await makeUser()

    await transaction(async (tx) => {
      expect(await consumeCommissionQuota(tx, userId, 10)).toBe(10)
      expect(await consumeCommissionQuota(tx, userId, 25)).toBe(25)
    })
  })

  it('memotong tepat di plafon dan menghanguskan sisanya', async () => {
    const { transaction } = await import('./db')
    const { consumeCommissionQuota } = await import('./quota')
    const userId = await makeUser()

    await transaction(async (tx) => {
      expect(await consumeCommissionQuota(tx, userId, dailyCommissionCreditCap() - 5)).toBe(55)
      expect(await consumeCommissionQuota(tx, userId, 20)).toBe(5)
      expect(await consumeCommissionQuota(tx, userId, 20)).toBe(0)
    })
  })

  it('tidak pernah membayar melebihi plafon dalam satu panggilan besar', async () => {
    const { transaction } = await import('./db')
    const { consumeCommissionQuota } = await import('./quota')
    const userId = await makeUser()

    await transaction(async (tx) => {
      expect(await consumeCommissionQuota(tx, userId, 10_000)).toBe(dailyCommissionCreditCap())
    })
  })

  it('menghitung plafon per user, bukan global', async () => {
    const { transaction } = await import('./db')
    const { consumeCommissionQuota } = await import('./quota')
    const a = await makeUser()
    const b = await makeUser()

    await transaction(async (tx) => {
      expect(await consumeCommissionQuota(tx, a, dailyCommissionCreditCap())).toBe(60)
      expect(await consumeCommissionQuota(tx, b, dailyCommissionCreditCap())).toBe(60)
    })
  })
})

describe('ECON-1 — satu tujuan pembayaran milik satu akun', () => {
  const draft = (accountNumber: string) => ({
    channelId: 'dana',
    accountNumber,
    accountName: 'Uji Coba',
    credits: 100,
  })

  it('menolak pengajuan ke tujuan yang sudah dipakai akun lain', async () => {
    const { createPayout, PayoutError } = await import('./payout')
    const first = await makeUser(500)
    const second = await makeUser(500)
    const destination = `0812${Math.floor(Math.random() * 100_000_000)}`

    await createPayout(first, draft(destination))

    await expect(createPayout(second, draft(destination))).rejects.toMatchObject({
      code: 'ACCOUNT_NUMBER_IN_USE',
    })
    await expect(createPayout(second, draft(destination))).rejects.toBeInstanceOf(PayoutError)
  })

  it('tidak menghalangi tujuan yang berbeda', async () => {
    const { createPayout } = await import('./payout')
    const first = await makeUser(500)
    const second = await makeUser(500)

    await createPayout(first, draft(`0813${Math.floor(Math.random() * 100_000_000)}`))
    await expect(
      createPayout(second, draft(`0814${Math.floor(Math.random() * 100_000_000)}`)),
    ).resolves.toBeTruthy()
  })

  it('tidak menghalangi pemilik tujuan itu sendiri mengajukan lagi', async () => {
    const { createPayout, settlePayout } = await import('./payout')
    const admin = await makeUser()
    const userId = await makeUser(500)
    const destination = `0815${Math.floor(Math.random() * 100_000_000)}`

    const { withdrawal } = await createPayout(userId, draft(destination))
    await settlePayout(admin, withdrawal.id, 'paid', '', null)

    await expect(createPayout(userId, draft(destination))).resolves.toBeTruthy()
  })
})

describe('ECON-4 — batas task harian mengikuti konfigurasi, bukan angka tetap', () => {
  afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

  it('berhenti membayar setelah maxTasksPerDay tercapai', async () => {
    const { transaction } = await import('./db')
    const { consumeQuota } = await import('./quota')
    const userId = await makeUser()
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, maxTasksPerDay: 3 })

    await transaction(async (tx) => {
      expect((await consumeQuota(tx, userId, 1)).paidReward).toBe(1)
      expect((await consumeQuota(tx, userId, 1)).paidReward).toBe(1)
      expect((await consumeQuota(tx, userId, 1)).paidReward).toBe(1)

      const beyond = await consumeQuota(tx, userId, 1)
      expect(beyond.paidReward).toBe(0)
      expect(beyond.exceeded).toBe(true)
    })
  })

  it('memakai batas yang lebih longgar ketika konfigurasinya dinaikkan', async () => {
    const { transaction } = await import('./db')
    const { consumeQuota } = await import('./quota')
    const userId = await makeUser()
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, maxTasksPerDay: 5 })

    await transaction(async (tx) => {
      for (let i = 0; i < 5; i += 1) {
        expect((await consumeQuota(tx, userId, 1)).paidReward).toBe(1)
      }
      expect((await consumeQuota(tx, userId, 1)).exceeded).toBe(true)
    })
  })
})
