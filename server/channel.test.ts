import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy-config'

const membership = vi.hoisted(() => ({ value: null as boolean | null }))

vi.mock('./telegram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./telegram')>()),
  readChannelMembership: vi.fn(async () => membership.value),
}))

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

afterEach(() => {
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
  membership.value = null
})

async function makeUser(): Promise<{ id: number; telegramId: string }> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const telegramId = String(900_000_000_000_000 + suffix)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code)
     values($1,'Uji Channel',$2) returning id`,
    [telegramId, generateReferralCode()],
  )
  return { id: Number(rows[0].id), telegramId }
}

const readBalance = async (userId: number) => {
  const { query } = await import('./db')
  const rows = await query<{ balance_credits: string }>(
    'select balance_credits from users where id=$1',
    [userId],
  )
  return Number(rows[0].balance_credits)
}

const countLedger = async (userId: number) => {
  const { query } = await import('./db')
  const rows = await query<{ jumlah: number }>(
    "select count(*)::int as jumlah from credit_ledger where user_id=$1 and idempotency_key like 'channel_bonus:%'",
    [userId],
  )
  return Number(rows[0].jumlah)
}

describe('CHAN-1 — bonus hanya untuk anggota channel yang terbukti', () => {
  it('membayar sekali dan menolak klaim kedua', async () => {
    const { claimChannelBonus } = await import('./channel')
    const user = await makeUser()
    membership.value = true

    const claimed = await claimChannelBonus(user.id, user.telegramId)
    expect(claimed).toMatchObject({
      ok: true,
      credits: DEFAULT_ECONOMY_CONFIG.channelJoinBonusCredits,
    })
    expect(await readBalance(user.id)).toBe(DEFAULT_ECONOMY_CONFIG.channelJoinBonusCredits)

    const again = await claimChannelBonus(user.id, user.telegramId)
    expect(again).toEqual({ ok: false, reason: 'already_claimed' })
    expect(await readBalance(user.id)).toBe(DEFAULT_ECONOMY_CONFIG.channelJoinBonusCredits)
    expect(await countLedger(user.id)).toBe(1)
  })

  it('menolak yang belum join tanpa menulis apa pun', async () => {
    const { claimChannelBonus } = await import('./channel')
    const user = await makeUser()
    membership.value = false

    expect(await claimChannelBonus(user.id, user.telegramId)).toEqual({
      ok: false,
      reason: 'not_member',
    })
    expect(await readBalance(user.id)).toBe(0)
    expect(await countLedger(user.id)).toBe(0)
  })

  it('menolak saat keanggotaan tidak bisa dipastikan, bukan menebak', async () => {
    const { claimChannelBonus } = await import('./channel')
    const user = await makeUser()
    membership.value = null

    expect(await claimChannelBonus(user.id, user.telegramId)).toEqual({
      ok: false,
      reason: 'unverifiable',
    })
    expect(await readBalance(user.id)).toBe(0)
    expect(await countLedger(user.id)).toBe(0)
  })

  it('mati total saat bonusnya disetel nol dari panel admin', async () => {
    const { claimChannelBonus } = await import('./channel')
    const user = await makeUser()
    membership.value = true
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, channelJoinBonusCredits: 0 })

    expect(await claimChannelBonus(user.id, user.telegramId)).toEqual({
      ok: false,
      reason: 'disabled',
    })
    expect(await countLedger(user.id)).toBe(0)
  })
})
