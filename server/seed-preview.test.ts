import { beforeAll, expect, it } from 'vitest'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

it('menyiapkan user preview yang layak menarik dana', async () => {
  const { query } = await import('./db')
  const { seedActiveDays, seedActiveReferrals, clearWithdrawalCooldown } = await import(
    './payout-fixtures'
  )
  const { getPayouts } = await import('./payout')
  const { generateReferralCode } = await import('./referral')

  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,username,first_name,referral_code,balance_credits)
     values($1,'preview_dev','Preview',$2,$3)
     on conflict(telegram_id) do update set balance_credits=$3
     returning id`,
    [900_000_000_000_001, generateReferralCode(), 500_000],
  )
  const id = Number(rows[0].id)

  await seedActiveReferrals(id)
  await seedActiveDays(id)
  await clearWithdrawalCooldown(id)

  const { eligibility } = await getPayouts(id)
  expect(eligibility.activeDays).toBeGreaterThanOrEqual(eligibility.requiredActiveDays)
})
