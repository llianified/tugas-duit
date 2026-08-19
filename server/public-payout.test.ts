import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

async function makePaidPayout(name: string, paidAgoMinutes: number, state: 'paid' | 'processing' = 'paid') {
  const { query } = await import('./db')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const user = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits)
     values($1,'Payout Test',$2,500) returning id`,
    [800_000_000_000_000 + suffix, `PT${suffix}`],
  )
  const ledger = await query<{ id: string }>(
    `insert into credit_ledger(user_id,kind,amount,balance_after,idempotency_key)
     values($1,'adjustment',500,500,$2) returning id`,
    [user[0].id, `public-payout-test:${suffix}`],
  )
  await query(
    `insert into withdrawals(
       user_id,channel_id,account_number,account_name,credits,amount_idr,
       state,hold_ledger_id,paid_at
     ) values($1,'dana',$2,$3,100,10000,$4::withdrawal_state,$5,
       case when $4::text='paid' then now()-($6 * interval '1 minute') else null end)`,
    [user[0].id, `0812${suffix}`, name, state, ledger[0].id, paidAgoMinutes],
  )
}

describe('payout publik', () => {
  it('memasker nama tanpa mempertahankan nama lengkap', async () => {
    const { maskPayoutRecipient } = await import('./payout')
    expect(maskPayoutRecipient('Budi Santoso')).toBe('B*** S***')
    expect(maskPayoutRecipient(' A ')).toBe('A*')
    expect(maskPayoutRecipient('')).toBe('***')
  })

  it('hanya mengembalikan payout paid, terbaru dulu, dan tanpa data pribadi', async () => {
    await makePaidPayout('Paling Lama', -200)
    await makePaidPayout('Paling Baru', -300)
    await makePaidPayout('Masih Proses', 0, 'processing')

    const { getPublicPayouts } = await import('./payout')
    const payouts = await getPublicPayouts(2)

    expect(payouts).toHaveLength(2)
    expect(payouts[0].recipient).toBe('P*** B***')
    expect(payouts[0].paidAt).toBeGreaterThan(payouts[1].paidAt)
    expect(payouts.some((item) => item.recipient.includes('Proses'))).toBe(false)
    for (const payout of payouts) {
      expect(Object.keys(payout).sort()).toEqual(
        ['amountIdr', 'channelId', 'credits', 'paidAt', 'recipient'].sort(),
      )
      expect(JSON.stringify(payout)).not.toContain('0812')
    }
  })
})
