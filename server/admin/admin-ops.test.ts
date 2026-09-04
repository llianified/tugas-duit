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
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

beforeEach(() => {
  jar.clear()
})

/** Direktori data PGlite preview bertahan antar-jalan uji, jadi baris dari jalan sebelumnya masih ada. Tiap kasus memakai penanda uniknya sendiri dan hanya menilai baris bertanda itu — bukan isi tabel secara keseluruhan. */
const tag = () => `TAG${Math.floor(Math.random() * 1_000_000_000)}`

async function makeUser(name: string, admin = false): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,is_admin)
     values($1,$2,$3,$4) returning id`,
    [410_000_000_000_000 + suffix, name, generateReferralCode(), admin],
  )
  return Number(rows[0].id)
}

/** Satu penarikan `processing` milik user baru. `withdrawals_one_active_per_user` melarang dua sekaligus per user, jadi tiap baris butuh usernya sendiri. */
async function makeWithdrawal(accountName: string): Promise<void> {
  const { query } = await import('../platform/db')
  const userId = await makeUser('Penarik')
  const ledger = await query<{ id: string }>(
    `insert into credit_ledger(user_id,kind,amount,balance_after,idempotency_key)
     values($1,'adjustment',100,100,$2) returning id`,
    [userId, `uji-payout-history:${userId}`],
  )
  await query(
    `insert into withdrawals(user_id,channel_id,account_number,account_name,credits,amount_idr,hold_ledger_id)
     values($1,'dana','081200000000',$2,100,10000,$3)`,
    [userId, accountName, Number(ledger[0].id)],
  )
}

async function signInAdmin(): Promise<void> {
  const { createSession } = await import('../auth/session')
  const adminId = await makeUser('Admin ops', true)
  jar.clear()
  await createSession(adminId, 'uji')
}

const namesFor = async (term: string): Promise<string[]> => {
  const { readPayoutHistory } = await import('./admin-ops')
  const page = await readPayoutHistory({ state: 'semua', term, offset: 0 })
  return page.entries.map((entry) => entry.accountName)
}

/**
 * Kolom pencarian admin memakai `LIKE`/`ILIKE`, dan `%` maupun `_` yang diketik
 * admin adalah wildcard kalau tidak di-escape. `searchAdminUsers` sudah meng-escape
 * sejak awal; `readPayoutHistory` tidak — jadi dua pencarian di panel yang sama
 * memperlakukan input yang sama secara berbeda, dan `%` di riwayat payout
 * mencocokkan seluruh tabel alih-alih nol baris.
 *
 * Tiap kasus di bawah memakai term yang MENGANDUNG penanda uniknya, jadi bedanya
 * bukan soal berapa baris yang kebetulan ada di database: versi ber-bug
 * mencocokkan baris bertanda itu, versi yang benar tidak.
 */
describe('ADM-1 — pencarian admin memperlakukan input sebagai teks literal', () => {
  it('tidak memperlakukan % sebagai wildcard di riwayat payout', async () => {
    await signInAdmin()
    const token = tag()
    await makeWithdrawal(`Budi ${token}`)

    // Tanpa escape, '%' di depan penanda tetap mencocokkan barisnya.
    expect(await namesFor(`%${token}`)).not.toContain(`Budi ${token}`)
  })

  it('tidak memperlakukan _ sebagai wildcard satu karakter', async () => {
    await signInAdmin()
    const token = tag()
    await makeWithdrawal(`Budi ${token}`)

    // Tanpa escape, 'Bud_' mencocokkan 'Budi'.
    expect(await namesFor(`Bud_ ${token}`)).not.toContain(`Budi ${token}`)
  })

  it('tetap menemukan potongan teks biasa', async () => {
    await signInAdmin()
    const token = tag()
    await makeWithdrawal(`Rahmat ${token}`)

    expect(await namesFor(`Rahmat ${token}`)).toContain(`Rahmat ${token}`)
  })

  it('menemukan baris yang memang mengandung % secara literal', async () => {
    await signInAdmin()
    const token = tag()
    await makeWithdrawal(`Diskon 50% ${token}`)

    expect(await namesFor(`50% ${token}`)).toEqual([`Diskon 50% ${token}`])
  })

  it('memakai aturan escape yang sama untuk pencarian user', async () => {
    const { searchAdminUsers } = await import('./admin-users')
    await signInAdmin()
    const token = tag()
    await makeUser(`Cari ${token}`)

    const wildcard = await searchAdminUsers(`%${token}`)
    expect(wildcard.map((row) => row.firstName)).not.toContain(`Cari ${token}`)

    const literal = await searchAdminUsers(`Cari ${token}`)
    expect(literal.map((row) => row.firstName)).toContain(`Cari ${token}`)
  })
})
