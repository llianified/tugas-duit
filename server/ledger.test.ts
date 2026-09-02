import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

async function makeUser(balance = 0): Promise<{ id: number; publicId: string }> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string; public_id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits)
     values($1,$2,$3,$4) returning id,public_id`,
    [700_000_000_000_000 + suffix, 'Uji', generateReferralCode(), balance],
  )
  const user = { id: Number(rows[0].id), publicId: rows[0].public_id }
  const { seedWithdrawalEligibility } = await import('./__fixtures__/payout')
  await seedWithdrawalEligibility(user.id)
  return user
}

describe('WD-1 — idempotensi appendLedger', () => {
  it('memulangkan entri yang sama tanpa membayar dua kali', async () => {
    const { transaction } = await import('./db')
    const { appendLedger } = await import('./ledger')
    const user = await makeUser()
    const key = `test:${Math.random()}`

    await transaction(async (tx) => {
      const first = await appendLedger(tx, { userId: user.id, kind: 'adjustment', amount: 10, idempotencyKey: key })
      const repeat = await appendLedger(tx, { userId: user.id, kind: 'adjustment', amount: 10, idempotencyKey: key })

      expect(repeat.ledgerId).toBe(first.ledgerId)
      expect(repeat.balance).toBe(10)
    })

    const { query } = await import('./db')
    const rows = await query<{ balance_credits: string }>('select balance_credits from users where id=$1', [user.id])
    expect(Number(rows[0].balance_credits)).toBe(10)
  })

  it('memulangkan saldo terkini, bukan balance_after historis', async () => {
    const { transaction } = await import('./db')
    const { appendLedger } = await import('./ledger')
    const user = await makeUser()
    const firstKey = `test:${Math.random()}`

    await transaction(async (tx) => {
      await appendLedger(tx, { userId: user.id, kind: 'adjustment', amount: 10, idempotencyKey: firstKey })
      await appendLedger(tx, { userId: user.id, kind: 'adjustment', amount: 5, idempotencyKey: `test:${Math.random()}` })

      const replay = await appendLedger(tx, { userId: user.id, kind: 'adjustment', amount: 10, idempotencyKey: firstKey })
      expect(replay.balance).toBe(15)
    })
  })
})

describe('ECON-5 — jalur koreksi adjustment', () => {
  it('menambah saldo dan mencatatnya sebagai adjustment', async () => {
    const { recordAdjustment } = await import('./ledger')
    const { query } = await import('./db')
    const user = await makeUser(50)

    const result = await recordAdjustment({
      adminId: 1,
      adminName: 'Admin',
      userPublicId: user.publicId,
      credits: 25,
      note: 'koreksi salah tandai',
    })
    expect(result?.balance).toBe(75)

    const rows = await query<{ kind: string; amount: string; note: string }>(
      'select kind,amount,note from credit_ledger where id=$1',
      [result?.ledgerId],
    )
    expect(rows[0].kind).toBe('adjustment')
    expect(Number(rows[0].amount)).toBe(25)
    expect(rows[0].note).toContain('Admin')
  })

  it('bisa menarik kembali credit yang salah diberikan', async () => {
    const { recordAdjustment } = await import('./ledger')
    const user = await makeUser(50)
    const result = await recordAdjustment({
      adminId: 1, adminName: 'Admin', userPublicId: user.publicId, credits: -20, note: 'tarik kembali',
    })
    expect(result?.balance).toBe(30)
  })

  it('ditolak database kalau saldo jadi negatif', async () => {
    const { recordAdjustment } = await import('./ledger')
    const user = await makeUser(10)
    await expect(
      recordAdjustment({ adminId: 1, adminName: 'Admin', userPublicId: user.publicId, credits: -50, note: 'terlalu besar' }),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('null untuk user yang tidak ada', async () => {
    const { recordAdjustment } = await import('./ledger')
    const result = await recordAdjustment({
      adminId: 1, adminName: 'Admin',
      userPublicId: '00000000-0000-0000-0000-000000000000',
      credits: 5, note: 'tidak ada',
    })
    expect(result).toBeNull()
  })
})

describe('ECON-6 — backstop transisi penarikan di database', () => {
  const draft = (accountNumber: string) => ({
    channelId: 'dana', accountNumber, accountName: 'Uji Coba', credits: 100,
  })

  async function paidWithdrawal(): Promise<string> {
    const { createPayout, settlePayout } = await import('./payout')
    const admin = await makeUser()
    const user = await makeUser(500)
    const { withdrawal } = await createPayout(user.id, draft(`0816${Math.floor(Math.random() * 100_000_000)}`))
    await settlePayout(admin.id, withdrawal.id, 'paid', '', null)
    return withdrawal.id
  }

  it('menolak paid -> rejected', async () => {
    const { query } = await import('./db')
    const id = await paidWithdrawal()
    await expect(
      query("update withdrawals set state='rejected',rejected_at=now(),paid_at=null where id=$1", [id]),
    ).rejects.toThrow(/tidak diizinkan/)
  })

  it('menolak paid -> processing', async () => {
    const { query } = await import('./db')
    const id = await paidWithdrawal()
    await expect(
      query("update withdrawals set state='processing',paid_at=null where id=$1", [id]),
    ).rejects.toThrow(/tidak diizinkan/)
  })

  it('mengizinkan update yang tidak menyentuh state', async () => {
    const { query } = await import('./db')
    const id = await paidWithdrawal()
    await expect(
      query("update withdrawals set admin_note='catatan' where id=$1", [id]),
    ).resolves.toBeTruthy()
  })

  it('menolak baris paid yang juga bertanda rejected', async () => {
    const { query } = await import('./db')
    const id = await paidWithdrawal()
    await expect(
      query('update withdrawals set rejected_at=now() where id=$1', [id]),
    ).rejects.toThrow(/withdrawals_state_consistent/)
  })
})

describe('ECON-11 — invarian ledger di database', () => {
  it('menolak tanda amount yang tidak cocok dengan kind', async () => {
    const { query } = await import('./db')
    const user = await makeUser(100)
    await expect(
      query(
        `insert into credit_ledger(user_id,kind,amount,balance_after,idempotency_key)
         values($1,'withdrawal_hold',50,150,$2)`,
        [user.id, `t:${Math.random()}`],
      ),
    ).rejects.toThrow(/credit_ledger_amount_sign/)

    await expect(
      query(
        `insert into credit_ledger(user_id,kind,amount,balance_after,idempotency_key)
         values($1,'task',-5,95,$2)`,
        [user.id, `t:${Math.random()}`],
      ),
    ).rejects.toThrow(/credit_ledger_amount_sign/)
  })

  it('mengizinkan adjustment ke dua arah', async () => {
    const { query } = await import('./db')
    const user = await makeUser(100)
    await expect(
      query(
        `insert into credit_ledger(user_id,kind,amount,balance_after,idempotency_key)
         values($1,'adjustment',-5,95,$2)`,
        [user.id, `t:${Math.random()}`],
      ),
    ).resolves.toBeTruthy()
  })

  it('menolak channel pembayaran yang tidak dikenal', async () => {
    const { createPayout, PayoutError } = await import('./payout')
    const user = await makeUser(500)
    await expect(
      createPayout(user.id, {
        channelId: 'karangan',
        accountNumber: `0817${Math.floor(Math.random() * 100_000_000)}`,
        accountName: 'Uji Coba',
        credits: 100,
      }),
    ).rejects.toBeInstanceOf(PayoutError)
  })

  it('menerima SETIAP channel yang ditawarkan aplikasi', async () => {
    const { createPayout } = await import('./payout')
    const { PAYOUT_CHANNELS } = await import('@/domain/withdrawal')

    for (const channel of PAYOUT_CHANNELS) {
      const payer = await makeUser(500)
      const body = channel.kind === 'ewallet' ? '8' : ''
      const account =
        (channel.kind === 'ewallet' ? '0' : '') +
        body +
        Array.from(
          { length: channel.digits.min - body.length - (channel.kind === 'ewallet' ? 1 : 0) },
          () => Math.floor(Math.random() * 10),
        ).join('')
      await expect(
        createPayout(payer.id, {
          channelId: channel.id,
          accountNumber: account,
          accountName: 'Uji Coba',
          credits: 100,
        }),
      ).resolves.toBeTruthy()
    }
  })

  it('menolak baris rejected tanpa alasan', async () => {
    const { query } = await import('./db')
    const { createPayout } = await import('./payout')
    const user = await makeUser(500)
    const { withdrawal } = await createPayout(user.id, {
      channelId: 'dana',
      accountNumber: `0818${Math.floor(Math.random() * 100_000_000)}`,
      accountName: 'Uji Coba',
      credits: 100,
    })
    await expect(
      query("update withdrawals set state='rejected',rejected_at=now() where id=$1", [withdrawal.id]),
    ).rejects.toThrow(/withdrawals_rejected_needs_reason/)
  })

  it('menolak truncate pada credit_ledger', async () => {
    const { query } = await import('./db')
    await expect(query('truncate credit_ledger cascade')).rejects.toThrow(/append-only/)
  })
})
