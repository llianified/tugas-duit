import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMY_CONFIG,
  setActiveEconomyConfig,
  type EconomyConfig,
} from '@/domain/economy/economy-config'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

const withConfig = (patch: Partial<EconomyConfig>) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...patch, adsCooldownSeconds: 0 })

async function makeUser(energy = 5): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
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
  const { query } = await import('../platform/db')
  const rows = await query<{ energy: number }>('select energy from users where id=$1', [userId])
  return Number(rows[0].energy)
}

async function readAdView(id: string) {
  const { query } = await import('../platform/db')
  const rows = await query<{
    state: string
    block_id: string
    consumed_at: Date | null
    ready_at: Date | null
    expires_at: Date
  }>('select state, block_id, consumed_at, ready_at, expires_at from ad_views where id=$1', [id])
  return rows[0]
}

async function readChallengeEntry(challengeId: string) {
  const { query } = await import('../platform/db')
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
    const { issueChallenge, startChallenge } = await import('../task/challenge')
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
    expect(await readAdView(ticketId)).toMatchObject({ state: 'consumed', block_id: '11615417' })
  })

  it('tetap memotong energi saat task dibayar energi', async () => {
    withConfig({})
    const { issueChallenge, startChallenge } = await import('../task/challenge')
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
    const { query } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('../task/challenge')
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
    const { query, transaction } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('../task/challenge')
    const { refundEntry } = await import('../economy/energy')
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
    const { query } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('../task/challenge')
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
    const { query, transaction } = await import('../platform/db')
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
    const { query } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('../task/challenge')
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
    const { issueChallenge, startChallenge } = await import('../task/challenge')
    const userId = await makeUser(5)
    await grantPass(userId)
    const challenge = await issueChallenge(userId)
    await startChallenge(userId, challenge.id, 'ad')

    expect(await openAdTicket(userId)).toMatchObject({ ok: false, reason: 'entry_open' })
  })

  it('mengembalikan tiketnya utuh saat task itu hangus tanpa percobaan', async () => {
    withConfig({})
    const { openAdTicket } = await import('./ads')
    const { transaction } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('../task/challenge')
    const { refundEntry } = await import('../economy/energy')
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
    const { query, transaction } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('../task/challenge')
    const { refundEntry } = await import('../economy/energy')
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
    const { query } = await import('../platform/db')
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

describe('ADS-DB-9 — pass yang dihidupkan ulang memakai tenggat aslinya', () => {
  it('tidak memperpanjang umur pass dan menolak menghidupkan pass yang sudah lewat tenggat', async () => {
    withConfig({})
    const ttlMs = DEFAULT_ECONOMY_CONFIG.adsPassTtlMinutes * 60_000
    const { query, transaction } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('../task/challenge')
    const { refundEntry } = await import('../economy/energy')
    const userId = await makeUser(5)
    const ticketId = await grantPass(userId)

    const first = await issueChallenge(userId)
    expect((await startChallenge(userId, first.id, 'ad')).ok).toBe(true)
    await query("update ad_views set ready_at=now()-interval '29 minutes' where id=$1", [ticketId])

    expect(await transaction((tx) => refundEntry(tx, userId, first.id))).toEqual({ refunded: true })
    const revived = await readAdView(ticketId)
    expect(revived.state).toBe('ready')
    expect(revived.ready_at).not.toBeNull()
    expect(revived.expires_at.getTime() - (revived.ready_at as Date).getTime()).toBe(ttlMs)
    expect(revived.expires_at.getTime() - Date.now()).toBeLessThan(ttlMs)

    await query('update challenges set submitted_at=now() where id=$1', [first.id])
    const second = await issueChallenge(userId)
    expect((await startChallenge(userId, second.id, 'ad')).ok).toBe(true)
    await query("update ad_views set ready_at=now()-interval '31 minutes' where id=$1", [ticketId])

    expect(await transaction((tx) => refundEntry(tx, userId, second.id))).toEqual({
      refunded: false,
    })
    expect((await readAdView(ticketId)).state).toBe('consumed')
    expect(await readEnergyValue(userId)).toBe(5)
  })
})

describe('ADS-DB-10 — potret sesi memberitahukan keadaan yang bikin tiket ditolak', () => {
  it('menyalakan entryOpen persis saat openAdTicket menolak dengan entry_open', async () => {
    withConfig({})
    const { openAdTicket, readAdsState } = await import('./ads')
    const { issueChallenge, startChallenge } = await import('../task/challenge')
    const userId = await makeUser(5)

    expect((await readAdsState(userId)).entryOpen).toBe(false)

    await grantPass(userId)
    const challenge = await issueChallenge(userId)
    await startChallenge(userId, challenge.id, 'ad')

    /** Keduanya dibaca dari hitungan yang sama. Kalau berselisih, tombol iklan akan tampak bisa diketuk padahal server sudah pasti menolaknya. */
    expect((await readAdsState(userId)).entryOpen).toBe(true)
    expect(await openAdTicket(userId)).toMatchObject({ ok: false, reason: 'entry_open' })
  })

  it('mengirim tenggat pass supaya klien bisa menghitung mundur umurnya', async () => {
    withConfig({ adsPassTtlMinutes: 30 })
    const { readAdsState } = await import('./ads')
    const userId = await makeUser(5)
    await grantPass(userId)

    const state = await readAdsState(userId)
    expect(state.pass).not.toBeNull()
    expect(state.pass!.expiresAt).toBeGreaterThan(state.now)
  })
})

describe('ADS-DB-11 — ronde Arena menahan tiket berikutnya, sama seperti task', () => {
  /** Arena memotong pass lewat `consumeAdPass` persis seperti `startChallenge`, jadi ia menanggung
   *  akibat yang sama: pass yang sudah dipakai baru bisa dihidupkan lagi kalau slot
   *  `ad_views_one_ready` kosong. Selama `entry_open` cuma menengok `challenges`, user bisa
   *  menonton iklan baru selagi rondenya terbuka — lalu saat ronde itu ditinggal, pengembalian
   *  passnya ditolak dan tiket yang sudah benar-benar ditonton hilang tanpa jejak. */
  it('menolak tiket baru selama ronde berbayar pass belum ditutup', async () => {
    withConfig({ arcadeEnabled: 1, arcadeAdGated: 1, arcadeCooldownSeconds: 0 })
    const { openAdTicket, readAdsState } = await import('./ads')
    const { openArcadePlay } = await import('../arcade/arcade')
    const userId = await makeUser(0)
    const ticketId = await grantPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    expect(opened.ok).toBe(true)
    expect((await readAdView(ticketId)).state).toBe('consumed')

    expect((await readAdsState(userId)).entryOpen).toBe(true)
    expect(await openAdTicket(userId)).toMatchObject({ ok: false, reason: 'entry_open' })
  })

  /** Sapuan ronde basi hanya jalan saat Arena dibuka. Tanpa saringan umur, satu ronde yang
   *  ditinggal akan mengunci tiket user sampai ia ingat membuka Arena lagi — menukar satu pass
   *  yang hilang dengan seluruh jalur iklan yang mati. */
  it('melepas kuncian itu begitu rondenya lewat umur, tanpa menunggu Arena dibuka lagi', async () => {
    withConfig({ arcadeEnabled: 1, arcadeAdGated: 1, arcadeCooldownSeconds: 0 })
    const { query } = await import('../platform/db')
    const { openAdTicket, readAdsState } = await import('./ads')
    const { openArcadePlay } = await import('../arcade/arcade')
    const userId = await makeUser(0)
    await grantPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error(`pembukaan ronde ditolak: ${opened.reason}`)
    await query("update arcade_plays set opened_at = now() - interval '1 hour' where id=$1", [
      opened.play.id,
    ])

    expect((await readAdsState(userId)).entryOpen).toBe(false)
    expect(await openAdTicket(userId)).toMatchObject({ ok: true })
  })
})

describe('ADS-DB-12 — pass mati tidak boleh ikut menghanguskan pass yang sedang dikembalikan', () => {
  /** Slot `ad_views_one_ready` bisa ditempati tiket yang tenggatnya sudah lewat: sapuannya
   *  hanya jalan di `readState`, bukan di jalur pengembalian. Sebelum perbaikan ini
   *  `restoreAdPass` membaca slot itu sebagai "user sudah pegang pass lain" lalu menolak —
   *  padahal pass di slot itu tidak bisa dipakai apa pun lagi. Yang hilang bukan angka:
   *  satu iklan yang benar-benar ditonton hangus permanen, dan tidak ada satu baris pun
   *  yang bisa dipakai user untuk membuktikannya. */
  it('menyapu pass yang sudah lewat tenggat lalu mengembalikan pass ronde yang ditinggal', async () => {
    withConfig({ arcadeEnabled: 1, arcadeAdGated: 1, arcadeCooldownSeconds: 0 })
    const { query } = await import('../platform/db')
    const { claimAdTicket, openAdTicket } = await import('./ads')
    const { openArcadePlay, readArcadeState } = await import('../arcade/arcade')
    const userId = await makeUser(0)

    const burned = await grantPass(userId)
    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error(`pembukaan ronde ditolak: ${opened.reason}`)
    expect((await readAdView(burned)).state).toBe('consumed')

    /** Ronde yang ditinggal melepas kuncian `entry_open` (ADS-DB-11), jadi tiket kedua
     *  memang boleh dibuka — dan tiket kedua itulah yang lalu menempati slotnya. */
    await query("update arcade_plays set opened_at = now() - interval '1 hour' where id=$1", [
      opened.play.id,
    ])
    const second = await openAdTicket(userId)
    if (!second.ok) throw new Error(`tiket kedua ditolak: ${second.reason}`)
    expect((await claimAdTicket(userId, second.ticketId)).ok).toBe(true)

    // Tiket kedua ikut mati tanpa pernah dipakai, tapi barisnya masih 'ready'.
    await query(
      "update ad_views set expires_at = now() - interval '1 minute' where id=$1",
      [second.ticketId],
    )

    await readArcadeState(userId)

    expect((await readAdView(second.ticketId)).state).toBe('expired')
    expect((await readAdView(burned)).state).toBe('ready')
  })

  /** Penjagaannya sendiri tidak ikut dilonggarkan: pass yang MASIH hidup tetap menolak
   *  pengembalian, supaya stok pass tidak bisa ditumpuk lewat ronde yang sengaja ditinggal. */
  it('tetap menolak kalau pass lain masih benar-benar bisa dipakai', async () => {
    withConfig({ arcadeEnabled: 1, arcadeAdGated: 1, arcadeCooldownSeconds: 0 })
    const { query } = await import('../platform/db')
    const { claimAdTicket, openAdTicket } = await import('./ads')
    const { openArcadePlay, readArcadeState } = await import('../arcade/arcade')
    const userId = await makeUser(0)

    const burned = await grantPass(userId)
    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error(`pembukaan ronde ditolak: ${opened.reason}`)

    await query("update arcade_plays set opened_at = now() - interval '1 hour' where id=$1", [
      opened.play.id,
    ])
    const second = await openAdTicket(userId)
    if (!second.ok) throw new Error(`tiket kedua ditolak: ${second.reason}`)
    expect((await claimAdTicket(userId, second.ticketId)).ok).toBe(true)

    await readArcadeState(userId)

    expect((await readAdView(second.ticketId)).state).toBe('ready')
    expect((await readAdView(burned)).state).toBe('consumed')
  })
})

