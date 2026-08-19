import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMY_CONFIG,
  setActiveEconomyConfig,
  type EconomyConfig,
} from '@/domain/economy-config'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID = 'uji-block'
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

const withConfig = (patch: Partial<EconomyConfig>) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...patch, adsCooldownSeconds: 0 })

async function makeUser(energy = 5): Promise<number> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,energy)
     values($1,'Uji',$2,$3) returning id`,
    [900_000_000_000_000 + suffix, generateReferralCode(), energy],
  )
  return Number(rows[0].id)
}

async function grantPass(userId: number): Promise<string> {
  const { claimAdTicket, openAdTicket } = await import('./ads')
  const opened = await openAdTicket(userId)
  if (!opened.ok) throw new Error(`tiket ditolak: ${opened.reason}`)
  const claimed = await claimAdTicket(userId, opened.ticketId)
  if (!claimed.ok) throw new Error(`klaim ditolak: ${claimed.reason}`)
  return opened.ticketId
}

async function readEnergyValue(userId: number): Promise<number> {
  const { query } = await import('./db')
  const rows = await query<{ energy: number }>('select energy from users where id=$1', [userId])
  return Number(rows[0].energy)
}

async function readAdView(id: string) {
  const { query } = await import('./db')
  const rows = await query<{ state: string; consumed_at: Date | null; ready_at: Date | null }>(
    'select state, consumed_at, ready_at from ad_views where id=$1',
    [id],
  )
  return rows[0]
}

async function readChallengeEntry(challengeId: string) {
  const { query } = await import('./db')
  const rows = await query<{
    ad_view_id: string | null
    energy_spent_at: Date | null
    energy_refunded_at: Date | null
  }>(
    'select ad_view_id, energy_spent_at, energy_refunded_at from challenges where id=$1',
    [challengeId],
  )
  return rows[0]
}

describe('ADS-DB-1 — pass membayar ongkos masuk, energi tidak tersentuh', () => {
  it('memulai task tanpa memotong energi dan menandai challenge-nya', async () => {
    withConfig({})
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser(5)
    const ticketId = await grantPass(userId)
    const challenge = await issueChallenge(userId)

    const started = await startChallenge(userId, challenge.id, 'ad')
    expect(started.ok).toBe(true)
    if (started.ok) expect(started.paidBy).toBe('ad')

    expect(await readEnergyValue(userId)).toBe(5)
    const row = await readChallengeEntry(challenge.id)
    expect(row.ad_view_id).toBe(ticketId)
    expect(row.energy_spent_at).toBeNull()
    expect((await readAdView(ticketId)).state).toBe('consumed')
  })

  it('tetap memotong energi saat task dibayar energi', async () => {
    withConfig({})
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser(5)
    const challenge = await issueChallenge(userId)

    const started = await startChallenge(userId, challenge.id, 'energy')
    expect(started.ok).toBe(true)
    if (started.ok) expect(started.paidBy).toBe('energy')
    expect(await readEnergyValue(userId)).toBe(4)
    expect((await readChallengeEntry(challenge.id)).ad_view_id).toBeNull()
  })
})

describe('ADS-DB-2 — kolam reward kosong menolak lebih dulu', () => {
  it('menolak start dan meninggalkan pass tetap siap pakai', async () => {
    withConfig({})
    const { query } = await import('./db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser(5)
    const ticketId = await grantPass(userId)
    await query('update users set reward_pool=0, reward_pool_updated_at=now() where id=$1', [userId])
    const challenge = await issueChallenge(userId)

    const started = await startChallenge(userId, challenge.id, 'ad')
    expect(started).toMatchObject({ ok: false, reason: 'pool_empty' })
    expect((await readAdView(ticketId)).state).toBe('ready')
    expect((await readChallengeEntry(challenge.id)).ad_view_id).toBeNull()
  })
})

describe('ADS-DB-3 — task hangus tanpa percobaan mengembalikan tiketnya', () => {
  it('menghidupkan pass sekali saja, dan tiket itu boleh membayar task berikutnya', async () => {
    withConfig({})
    const { query, transaction } = await import('./db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const { refundEntry } = await import('./energy')
    const userId = await makeUser(5)
    const ticketId = await grantPass(userId)
    const first = await issueChallenge(userId)
    await startChallenge(userId, first.id, 'ad')

    const restored = await transaction((tx) => refundEntry(tx, userId, first.id))
    expect(restored).toEqual({ refunded: true })
    expect((await readAdView(ticketId)).state).toBe('ready')

    const again = await transaction((tx) => refundEntry(tx, userId, first.id))
    expect(again).toEqual({ refunded: false })

    const counted = await query<{ jumlah: number }>(
      'select count(*)::int as jumlah from ad_views where user_id=$1',
      [userId],
    )
    expect(Number(counted[0].jumlah)).toBe(1)

    await query('update challenges set submitted_at=now() where id=$1', [first.id])
    const second = await issueChallenge(userId)
    const restarted = await startChallenge(userId, second.id, 'ad')
    expect(restarted.ok).toBe(true)
    expect(await readEnergyValue(userId)).toBe(5)
    expect((await readChallengeEntry(second.id)).ad_view_id).toBe(ticketId)
  })
})

describe('ADS-DB-4 — satu pass tidak bisa membayar dua task', () => {
  it('hanya meloloskan satu dari dua start yang berjalan bersamaan', async () => {
    withConfig({})
    const { query } = await import('./db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser(5)
    await grantPass(userId)

    const first = await issueChallenge(userId)
    await query('update challenges set submitted_at=now() where id=$1', [first.id])
    const second = await issueChallenge(userId)

    const [a, b] = await Promise.all([
      startChallenge(userId, first.id, 'ad'),
      startChallenge(userId, second.id, 'ad'),
    ])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    const refused = a.ok ? b : a
    expect(refused).toMatchObject({ ok: false })
    expect(await readEnergyValue(userId)).toBe(5)
  })
})

describe('ADS-DB-5 — plafon harian menolak sebelum tiket dibuka', () => {
  it('tidak menyisakan baris tiket baru saat jatah habis', async () => {
    withConfig({ adsMaxViewsPerDay: 1 })
    const { query, transaction } = await import('./db')
    const { consumeAdPass, openAdTicket } = await import('./ads')
    const userId = await makeUser(5)
    await grantPass(userId)
    await transaction((tx) => consumeAdPass(tx, userId))

    const refused = await openAdTicket(userId)
    expect(refused).toMatchObject({ ok: false, reason: 'daily_limit', viewsLeft: 0 })

    const counted = await query<{ jumlah: number }>(
      'select count(*)::int as jumlah from ad_views where user_id=$1',
      [userId],
    )
    expect(Number(counted[0].jumlah)).toBe(1)
  })
})

describe('ADS-DB-6 — pass kedaluwarsa tidak membayar apa pun', () => {
  it('menolak start berbayar iklan, dan energi tetap yang membayar kalau user memilih energi', async () => {
    withConfig({})
    const { query } = await import('./db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser(5)
    const ticketId = await grantPass(userId)
    await query("update ad_views set expires_at=now()-interval '1 second' where id=$1", [ticketId])
    const challenge = await issueChallenge(userId)

    const refused = await startChallenge(userId, challenge.id, 'ad')
    expect(refused).toMatchObject({ ok: false, reason: 'ad_pass_missing' })
    expect(await readEnergyValue(userId)).toBe(5)
    expect((await readChallengeEntry(challenge.id)).ad_view_id).toBeNull()

    const started = await startChallenge(userId, challenge.id, 'energy')
    expect(started.ok).toBe(true)
    expect(await readEnergyValue(userId)).toBe(4)
  })
})

describe('ADS-DB-7 — tiket tidak bisa ditumpuk di atas task yang sedang dibayarinya', () => {
  it('menolak membuka tiket baru selama challenge berbayar iklan belum ditutup', async () => {
    withConfig({})
    const { openAdTicket } = await import('./ads')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser(5)
    await grantPass(userId)
    const challenge = await issueChallenge(userId)
    await startChallenge(userId, challenge.id, 'ad')

    expect(await openAdTicket(userId)).toMatchObject({ ok: false, reason: 'entry_open' })
  })

  it('mengembalikan tiketnya utuh saat task itu hangus tanpa percobaan', async () => {
    withConfig({})
    const { openAdTicket } = await import('./ads')
    const { transaction } = await import('./db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const { refundEntry } = await import('./energy')
    const userId = await makeUser(5)
    const ticketId = await grantPass(userId)
    const challenge = await issueChallenge(userId)
    await startChallenge(userId, challenge.id, 'ad')

    expect(await transaction((tx) => refundEntry(tx, userId, challenge.id))).toEqual({
      refunded: true,
    })
    expect((await readAdView(ticketId)).state).toBe('ready')
    expect(await openAdTicket(userId)).toMatchObject({ ok: false, reason: 'pass_ready' })
  })

  it('tidak menghanguskan tiket saat pass lain sudah siap — utangnya tetap tercatat', async () => {
    withConfig({})
    const { query, transaction } = await import('./db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const { refundEntry } = await import('./energy')
    const userId = await makeUser(5)
    const ticketId = await grantPass(userId)
    const challenge = await issueChallenge(userId)
    await startChallenge(userId, challenge.id, 'ad')
    await query(
      `insert into ad_views(user_id,block_id,state,expires_at,ready_at)
       values($1,'uji-block','ready',now()+interval '30 minutes',now())`,
      [userId],
    )

    expect(await transaction((tx) => refundEntry(tx, userId, challenge.id))).toEqual({
      refunded: false,
    })
    expect((await readAdView(ticketId)).state).toBe('consumed')
    const rows = await query<{ energy_refunded_at: Date | null }>(
      'select energy_refunded_at from challenges where id=$1',
      [challenge.id],
    )
    expect(rows[0].energy_refunded_at).toBeNull()
  })
})

describe('ADS-DB-8 — tayangan yang tidak pernah diklaim tidak memotong jatah', () => {
  it('menyerahkan kembali tiket yang sama, tanpa menambah baris maupun memotong jatah', async () => {
    withConfig({ adsMaxViewsPerDay: 2 })
    const { query } = await import('./db')
    const { openAdTicket, readAdsState } = await import('./ads')
    const userId = await makeUser(5)

    const first = await openAdTicket(userId)
    expect(first.ok).toBe(true)
    const second = await openAdTicket(userId)
    expect(second).toMatchObject({ ok: true })
    if (!first.ok || !second.ok) return
    expect(second.ticketId).toBe(first.ticketId)

    const counted = await query<{ jumlah: number }>(
      'select count(*)::int as jumlah from ad_views where user_id=$1',
      [userId],
    )
    expect(Number(counted[0].jumlah)).toBe(1)
    expect((await readAdsState(userId)).viewsLeft).toBe(2)
  })

  it('memotong jatah begitu tiketnya diklaim', async () => {
    withConfig({ adsMaxViewsPerDay: 2 })
    const { readAdsState } = await import('./ads')
    const userId = await makeUser(5)
    await grantPass(userId)

    expect((await readAdsState(userId)).viewsLeft).toBe(1)
  })
})
