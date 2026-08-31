import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const jar = vi.hoisted(() => new Map<string, string>())

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value)
    },
    delete: (name: string) => {
      jar.delete(name)
    },
  }),
}))

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

beforeEach(() => {
  jar.clear()
})

async function makeUser(
  options: { balance?: number; admin?: boolean } = {},
): Promise<{ id: number; publicId: string }> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string; public_id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits,is_admin)
     values($1,'Pantau',$2,$3,$4) returning id,public_id`,
    [
      400_000_000_000_000 + suffix,
      generateReferralCode(),
      options.balance ?? 0,
      options.admin ?? false,
    ],
  )
  return { id: Number(rows[0].id), publicId: rows[0].public_id }
}

async function signIn(userId: number): Promise<void> {
  const { createSession } = await import('./session')
  jar.clear()
  await createSession(userId, 'uji')
}

describe('otorisasi', () => {
  it('menolak pembacaan tanpa sesi', async () => {
    const { readAdminDashboard } = await import('./admin-stats')
    await expect(readAdminDashboard()).rejects.toThrow()
  })

  it('menolak user biasa', async () => {
    const { readAdminDashboard } = await import('./admin-stats')
    const user = await makeUser()
    await signIn(user.id)
    await expect(readAdminDashboard()).rejects.toThrow()
  })

  it('menolak admin yang ditangguhkan', async () => {
    const { query } = await import('./db')
    const { readAdminDashboard } = await import('./admin-stats')
    const admin = await makeUser({ admin: true })
    await signIn(admin.id)
    await query('update users set banned_at=now() where id=$1', [admin.id])
    await expect(readAdminDashboard()).rejects.toThrow()
  })

  it('menerima admin', async () => {
    const { readAdminDashboard } = await import('./admin-stats')
    const admin = await makeUser({ admin: true })
    await signIn(admin.id)
    await expect(readAdminDashboard()).resolves.toBeTruthy()
  })
})

describe('agregat dashboard', () => {
  it('menghitung total user, saldo beredar, dan pendaftar hari ini', async () => {
    const { readAdminDashboard } = await import('./admin-stats')
    const admin = await makeUser({ admin: true })
    await signIn(admin.id)

    const before = await readAdminDashboard()
    await makeUser({ balance: 250 })
    const after = await readAdminDashboard()

    expect(after.users.total).toBe(before.users.total + 1)
    expect(after.outstandingCredits).toBe(before.outstandingCredits + 250)
    expect(after.users.newToday).toBe(before.users.newToday + 1)
  })

  it('menghitung credit dibayar hanya dari task dan komisi', async () => {
    const { transaction } = await import('./db')
    const { appendLedger } = await import('./ledger')
    const { readAdminDashboard } = await import('./admin-stats')
    const admin = await makeUser({ admin: true })
    await signIn(admin.id)

    const user = await makeUser()
    const before = await readAdminDashboard()

    await transaction(async (tx) => {
      await appendLedger(tx, { userId: user.id, kind: 'task', amount: 9, idempotencyKey: `d:${Math.random()}` })
      await appendLedger(tx, { userId: user.id, kind: 'commission', amount: 1, idempotencyKey: `d:${Math.random()}` })
      await appendLedger(tx, { userId: user.id, kind: 'withdrawal_hold', amount: -10, idempotencyKey: `d:${Math.random()}` })
    })

    const after = await readAdminDashboard()
    expect(after.paid.totalCredits).toBe(before.paid.totalCredits + 10)
    expect(after.paid.todayCredits).toBe(before.paid.todayCredits + 10)
    expect(after.outstandingCredits).toBe(before.outstandingCredits)
  })

  it('memisahkan antrean payout menurut statusnya', async () => {
    const { createPayout, settlePayout } = await import('./payout')
    const { readAdminDashboard } = await import('./admin-stats')
    const admin = await makeUser({ admin: true })
    await signIn(admin.id)

    const payer = await makeUser({ balance: 500 })
    const { seedWithdrawalEligibility } = await import('./payout-fixtures')
    await seedWithdrawalEligibility(payer.id)

    const before = await readAdminDashboard()
    const { withdrawal } = await createPayout(payer.id, {
      channelId: 'dana',
      accountNumber: `08${Math.floor(Math.random() * 1_000_000_000)}`,
      accountName: 'Uji Coba',
      credits: 100,
    })

    await signIn(admin.id)
    const pending = await readAdminDashboard()
    expect(pending.payouts.pendingCount).toBe(before.payouts.pendingCount + 1)
    expect(pending.payouts.pendingCredits).toBe(before.payouts.pendingCredits + 100)

    await settlePayout(admin.id, withdrawal.id, 'paid', '', null)
    await signIn(admin.id)
    const settled = await readAdminDashboard()
    expect(settled.payouts.pendingCount).toBe(before.payouts.pendingCount)
    expect(settled.payouts.paidCount).toBe(before.payouts.paidCount + 1)
  })
})

describe('umpan aktivitas', () => {
  it('menggabungkan pendaftaran dan pergerakan ledger dalam satu urutan waktu', async () => {
    const { transaction } = await import('./db')
    const { appendLedger } = await import('./ledger')
    const { readAdminActivity } = await import('./admin-stats')
    const admin = await makeUser({ admin: true })

    const user = await makeUser()
    await transaction(async (tx) => {
      await appendLedger(tx, { userId: user.id, kind: 'task', amount: 5, idempotencyKey: `a:${Math.random()}` })
    })

    await signIn(admin.id)
    const entries = await readAdminActivity(100)
    const mine = entries.filter((entry) => entry.userPublicId === user.publicId)
    expect(mine.map((entry) => entry.kind).sort()).toEqual(['signup', 'task'])
    expect(mine.find((entry) => entry.kind === 'task')?.amount).toBe(5)
    expect(mine.find((entry) => entry.kind === 'signup')?.amount).toBeNull()
  })

  it('terurut dari yang terbaru', async () => {
    const { readAdminActivity } = await import('./admin-stats')
    const admin = await makeUser({ admin: true })
    await signIn(admin.id)
    const times = (await readAdminActivity(50)).map((entry) => entry.at)
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it('tidak pernah membawa nomor rekening maupun telegram_id', async () => {
    const { readAdminActivity } = await import('./admin-stats')
    const admin = await makeUser({ admin: true })
    await signIn(admin.id)
    for (const entry of await readAdminActivity(10)) {
      expect(Object.keys(entry).sort()).toEqual(
        ['amount', 'at', 'kind', 'note', 'userName', 'userPublicId'].sort(),
      )
    }
  })
})
