import { beforeAll, describe, expect, it } from 'vitest'
import { PAYOUT_CHANNELS } from '@/features/withdraw/domain'
import { withdrawalMinimumCredits } from '@/domain/economy'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

async function makeUser(balance: number): Promise<number> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits)
     values($1,$2,$3,$4) returning id`,
    [900_000_000_000_000 + suffix, 'Uji', generateReferralCode(), balance],
  )
  return Number(rows[0].id)
}

const accountFor = (channel: (typeof PAYOUT_CHANNELS)[number]): string => {
  const digits = channel.digits.min
  const body = String(Math.floor(Math.random() * 10 ** (digits - 1))).padStart(digits - 1, '0')
  return `0${body}`.slice(0, digits).padEnd(digits, '7')
}

describe('WD-6 — setiap channel di PAYOUT_CHANNELS diterima database', () => {
  it.each(PAYOUT_CHANNELS.map((channel) => [channel.id, channel] as const))(
    'menerima pengajuan ke %s',
    async (_id, channel) => {
      const { createPayout } = await import('./payout')
      const credits = withdrawalMinimumCredits()
      const userId = await makeUser(credits)

      const created = await createPayout(userId, {
        channelId: channel.id,
        accountNumber: accountFor(channel),
        accountName: 'Uji Kanal',
        credits,
      })

      expect(created.withdrawal.channelId).toBe(channel.id)
      expect(Number(created.withdrawal.credits)).toBe(credits)
    },
  )
})
