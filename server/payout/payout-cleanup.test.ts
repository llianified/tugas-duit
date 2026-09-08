import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creditsToRupiah, withdrawalMinimumCredits } from '@/domain/economy/economy'
import { PAYOUT_CHANNELS } from '@/domain/economy/withdrawal'

let originalConfig: unknown

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
  const rows = await query<{ config: unknown }>('select config from economy_config where id=1')
  originalConfig = rows[0].config
})

afterAll(async () => {
  const { query } = await import('../platform/db')
  const { invalidateEconomyConfigCache, loadEconomyConfig } = await import('../economy/economy-config')
  await query('update economy_config set config=$1::jsonb where id=1', [JSON.stringify(originalConfig)])
  invalidateEconomyConfigCache()
  await loadEconomyConfig()
})

async function setPremiumGate(required: boolean) {
  const { query } = await import('../platform/db')
  const { economyConfig, setActiveEconomyConfig } = await import('@/domain/economy/economy-config')
  setActiveEconomyConfig({ ...economyConfig(), withdrawalRequiresPremium: required ? 1 : 0 })
  await query(
    `update economy_config
        set config=jsonb_set(config, '{withdrawalRequiresPremium}', $1::jsonb, true)
      where id=1`,
    [required ? '1' : '0'],
  )
}

async function makeUser(balance: number, premium: boolean): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits,premium_until)
     values($1,'Uji cleanup',$2,$3,case when $4 then now()+interval '30 days' end) returning id`,
    [850_000_000_000_000 + suffix, generateReferralCode(), balance, premium],
  )
  const userId = Number(rows[0].id)
  const { seedWithdrawalEligibility } = await import('../__fixtures__/payout')
  await seedWithdrawalEligibility(userId)
  return userId
}

async function createWithdrawal(userId: number) {
  const { createPayout } = await import('./payout')
  const channel = PAYOUT_CHANNELS[0]
  return createPayout(userId, {
    channelId: channel.id,
    accountNumber: `08${Math.floor(Math.random() * 10 ** (channel.digits.min - 2))}`
      .padEnd(channel.digits.min, '7')
      .slice(0, channel.digits.min),
    accountName: 'Uji Cleanup',
    credits: withdrawalMinimumCredits(),
  })
}

describe('WD-14 — Premium wajib sampai penarikan selesai', () => {
  it('refund tepat sekali, menghapus history withdrawal, dan mempertahankan audit ledger', async () => {
    const { query } = await import('../platform/db')
    const { cleanupInactivePremiumWithdrawals } = await import('./payout-cleanup')
    await setPremiumGate(false)
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits, false)
    const created = await createWithdrawal(userId)
    await setPremiumGate(true)

    const cleaned = await cleanupInactivePremiumWithdrawals()
    expect(cleaned).toBeGreaterThanOrEqual(1)
    await expect(cleanupInactivePremiumWithdrawals()).resolves.toBe(0)

    expect(await query('select 1 from withdrawals where id=$1', [created.withdrawal.id])).toEqual([])
    const history = await (await import('./payout')).getPayouts(userId)
    expect(history.withdrawals).toEqual([])
    expect(history.totals.processingCredits).toBe(0)
    const ledger = await query<{ kind: string; amount: string }>(
      `select kind,amount from credit_ledger where user_id=$1 order by id`,
      [userId],
    )
    expect(ledger).toEqual([
      { kind: 'withdrawal_hold', amount: String(-credits) },
      { kind: 'withdrawal_refund', amount: String(credits) },
    ])
    const balance = await query<{ balance_credits: string; ledger_total: string }>(
      `select u.balance_credits,
              (select coalesce(sum(amount),0) from credit_ledger where user_id=u.id) ledger_total
         from users u where u.id=$1`,
      [userId],
    )
    expect(balance[0]).toEqual({ balance_credits: String(credits), ledger_total: '0' })
  })

  it('membiarkan withdrawal Premium aktif dan state final', async () => {
    const { query } = await import('../platform/db')
    const { cleanupInactivePremiumWithdrawals } = await import('./payout-cleanup')
    await setPremiumGate(false)
    const credits = withdrawalMinimumCredits()
    const premiumId = await makeUser(credits, true)
    const finalId = await makeUser(credits, false)
    const premium = await createWithdrawal(premiumId)
    const final = await createWithdrawal(finalId)
    await query(
      `update withdrawals set state='paid',paid_at=now() where id=$1`,
      [final.withdrawal.id],
    )
    await setPremiumGate(true)

    await cleanupInactivePremiumWithdrawals()

    expect(await query('select 1 from withdrawals where id=$1', [premium.withdrawal.id])).toHaveLength(1)
    expect(await query('select 1 from withdrawals where id=$1', [final.withdrawal.id])).toHaveLength(1)
  })

  it('settlement non-Premium commit refund/delete lalu menjawab konflik', async () => {
    const { query } = await import('../platform/db')
    const { settlePayout } = await import('./payout')
    await setPremiumGate(false)
    const credits = withdrawalMinimumCredits()
    const adminId = await makeUser(0, true)
    const userId = await makeUser(credits, false)
    const created = await createWithdrawal(userId)
    await setPremiumGate(true)

    await expect(settlePayout(adminId, created.withdrawal.id, 'paid', '', null)).rejects.toMatchObject({
      code: 'PREMIUM_EXPIRED_REFUNDED',
      status: 409,
    })
    expect(await query('select 1 from withdrawals where id=$1', [created.withdrawal.id])).toEqual([])
    const refund = await query(
      `select 1 from credit_ledger where idempotency_key=$1`,
      [`withdrawal_refund:${created.withdrawal.id}`],
    )
    expect(refund).toHaveLength(1)
  })

  it('settlement Premium aktif berjalan normal', async () => {
    const { settlePayout } = await import('./payout')
    await setPremiumGate(true)
    const credits = withdrawalMinimumCredits()
    const adminId = await makeUser(0, true)
    const userId = await makeUser(credits, true)
    const created = await createWithdrawal(userId)

    await expect(settlePayout(adminId, created.withdrawal.id, 'paid', '', null)).resolves.toMatchObject({
      withdrawal: { id: created.withdrawal.id, state: 'paid' },
    })
  })

  it('backstop menolak insert mentah non-Premium saat gate aktif', async () => {
    const { query } = await import('../platform/db')
    await setPremiumGate(false)
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits, false)
    const created = await createWithdrawal(userId)
    const hold = await query<{ hold_ledger_id: string }>(
      'select hold_ledger_id from withdrawals where id=$1',
      [created.withdrawal.id],
    )
    await query('delete from withdrawals where id=$1', [created.withdrawal.id])
    await setPremiumGate(true)

    await expect(
      query(
        `insert into withdrawals(
           user_id,channel_id,account_number,account_name,credits,amount_idr,hold_ledger_id
         ) values($1,$2,$3,$4,$5,$6,$7)`,
        [
          userId,
          PAYOUT_CHANNELS[0].id,
          '081234567890',
          'Runtime lama',
          credits,
          creditsToRupiah(credits),
          hold[0].hold_ledger_id,
        ],
      ),
    ).rejects.toMatchObject({ constraint: 'withdrawals_premium_required' })
  })

  it('backstop menahan SQL lama saat gate aktif, mengizinkan delete, dan no-op saat dimatikan', async () => {
    const { query } = await import('../platform/db')
    await setPremiumGate(false)
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits * 3, false)
    const first = await createWithdrawal(userId)
    await setPremiumGate(true)

    await expect(
      query(
        `update withdrawals
            set state='paid', paid_at=now(), processed_by=$2
          where id=$1`,
        [first.withdrawal.id, userId],
      ),
    ).rejects.toMatchObject({ constraint: 'withdrawals_premium_required' })
    await expect(query('delete from withdrawals where id=$1', [first.withdrawal.id])).resolves.toEqual([])

    await setPremiumGate(false)
    const second = await createWithdrawal(userId)
    await expect(
      query(
        `update withdrawals
            set state='paid', paid_at=now(), processed_by=$2
          where id=$1`,
        [second.withdrawal.id, userId],
      ),
    ).resolves.toHaveLength(0)
  })
})
