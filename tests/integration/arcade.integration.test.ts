import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMY_CONFIG,
  setActiveEconomyConfig,
  type EconomyConfig,
} from '@/domain/economy/economy-config'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../../server/platform/db')
  await query('select 1')
}, 120_000)

/** Arena mati di bawaan, jadi setiap tes menyalakannya sendiri. Bobot diatur ekstrem — satu hadiah berbobot, sisanya nol — supaya hasil undian menjadi pasti tanpa perlu menyetel `Math.random`. Yang diuji di berkas ini memang bukan keacakannya (itu urusan `domain/arcade/arcade.test.ts`), melainkan apa yang tersentuh di database. */
const configure = (patch: Partial<EconomyConfig> = {}) =>
  setActiveEconomyConfig({
    ...DEFAULT_ECONOMY_CONFIG,
    arcadeEnabled: 1,
    arcadeCooldownSeconds: 0,
    arcadePoolPrizeWeight: 1,
    arcadeEnergyPrizeWeight: 0,
    arcadeBlankWeight: 0,
    ...patch,
  })

beforeEach(() => configure())

async function makeUser(): Promise<number> {
  const { query } = await import('../../server/platform/db')
  const { generateReferralCode } = await import('../../server/economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,energy,reward_pool,reward_pool_updated_at)
     values($1,'Uji Arena',$2,0,0,now()) returning id`,
    [String(910_000_000_000_000 + suffix), generateReferralCode()],
  )
  return Number(rows[0].id)
}

/** Pass iklan siap pakai, ditulis langsung alih-alih lewat `openAdTicket` + `claimAdTicket`: yang sedang diuji Arena, dan menyeret seluruh alur tiket ke sini hanya menambah cara tes ini bisa gagal karena hal lain. */
async function giveAdPass(userId: number): Promise<void> {
  const { query } = await import('../../server/platform/db')
  await query(
    `insert into ad_views(user_id,block_id,state,ready_at,expires_at)
     values($1,'uji','ready',now(),now()+interval '30 minutes')`,
    [userId],
  )
}

const readUser = async (userId: number) => {
  const { query } = await import('../../server/platform/db')
  const rows = await query<{ energy: number; reward_pool: number }>(
    'select energy, reward_pool from users where id=$1',
    [userId],
  )
  return { energy: Number(rows[0].energy), pool: Number(rows[0].reward_pool) }
}

const countPasses = async (userId: number, state: string) => {
  const { query } = await import('../../server/platform/db')
  const rows = await query<{ count: number }>(
    'select count(*)::int as count from ad_views where user_id=$1 and state=$2',
    [userId, state],
  )
  return Number(rows[0].count)
}

describe('ARCADE-DB-1 — ongkos masuk dibayar sekali, di pembukaan', () => {
  it('memotong tepat satu pass iklan dan menuliskan satu baris main', async () => {
    const { openArcadePlay } = await import('../../server/arcade/arcade')
    const { query } = await import('../../server/platform/db')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    expect(opened.ok).toBe(true)
    expect(await countPasses(userId, 'ready')).toBe(0)
    expect(await countPasses(userId, 'consumed')).toBe(1)

    const rows = await query<{ count: number }>(
      "select count(*)::int as count from arcade_plays where user_id=$1 and state='open'",
      [userId],
    )
    expect(Number(rows[0].count)).toBe(1)
  })

  it('menolak main tanpa pass, dan penolakannya tidak meninggalkan baris apa pun', async () => {
    const { openArcadePlay } = await import('../../server/arcade/arcade')
    const { query } = await import('../../server/platform/db')
    const userId = await makeUser()

    expect(await openArcadePlay(userId, 'boxes')).toEqual({ ok: false, reason: 'no_ad_pass' })
    const rows = await query<{ count: number }>(
      'select count(*)::int as count from arcade_plays where user_id=$1',
      [userId],
    )
    expect(Number(rows[0].count)).toBe(0)
  })

  it('menolak ronde kedua selagi yang pertama belum ditutup', async () => {
    const { openArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)
    await openArcadePlay(userId, 'boxes')
    await giveAdPass(userId)

    expect(await openArcadePlay(userId, 'match')).toEqual({ ok: false, reason: 'play_open' })
    // Pass kedua tidak ikut terbakar oleh penolakan.
    expect(await countPasses(userId, 'ready')).toBe(1)
  })
})

describe('ARCADE-DB-2 — jatah harian mengikat', () => {
  it('menolak pembukaan setelah jatah hari itu habis', async () => {
    configure({ arcadeMaxPlaysPerDay: 2 })
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()

    for (let i = 0; i < 2; i += 1) {
      await giveAdPass(userId)
      const opened = await openArcadePlay(userId, 'boxes')
      expect(opened.ok).toBe(true)
      if (opened.ok) await settleArcadePlay(userId, { playId: opened.play.id, pick: 0 })
    }

    await giveAdPass(userId)
    expect(await openArcadePlay(userId, 'boxes')).toEqual({ ok: false, reason: 'daily_cap' })
    expect(await countPasses(userId, 'ready')).toBe(1)
  })
})

describe('ARCADE-DB-3 — hadiah benar-benar mendarat di kolom yang tepat', () => {
  it('mengisi stok reward, bukan saldo', async () => {
    configure({ arcadePoolPrizeCredits: 7 })
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    const settled = await settleArcadePlay(userId, { playId: opened.play.id, pick: 1 })

    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(settled.prize).toEqual({ kind: 'pool', amount: 7 })

    const after = await readUser(userId)
    expect(after.pool).toBe(7)
    /** Saldo tidak boleh bergerak satu credit pun. Ini inti seluruh rancangan Arena: hadiahnya membuka KESEMPATAN menghasilkan, bukan mencetak credit yang bisa langsung ditarik. */
    const { query } = await import('../../server/platform/db')
    const balance = await query<{ balance_credits: number }>(
      'select balance_credits from users where id=$1',
      [userId],
    )
    expect(Number(balance[0].balance_credits)).toBe(0)
  })

  it('memberi energi saat hadiah energi yang keluar', async () => {
    configure({
      arcadePoolPrizeWeight: 0,
      arcadeEnergyPrizeWeight: 1,
      arcadeEnergyPrizeAmount: 2,
    })
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    const settled = await settleArcadePlay(userId, { playId: opened.play.id, pick: 2 })

    expect(settled.ok).toBe(true)
    if (settled.ok) expect(settled.prize).toEqual({ kind: 'energy', amount: 2 })
    expect((await readUser(userId)).energy).toBe(2)
  })

  it('ronde Cocokkan Kartu yang kalah tidak membayar apa pun, tapi tetap tertutup', async () => {
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'match')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    const settled = await settleArcadePlay(userId, { playId: opened.play.id, won: false })

    expect(settled.ok).toBe(true)
    if (settled.ok) expect(settled.prize).toEqual({ kind: 'blank', amount: 0 })
    expect(await readUser(userId)).toEqual({ energy: 0, pool: 0 })
  })
})

describe('ARCADE-DB-4 — hadiah yang tidak muat dicoret sebelum iklannya dibakar', () => {
  it('menolak pembukaan saat stok dan energi sama-sama penuh', async () => {
    const { query } = await import('../../server/platform/db')
    const { openArcadePlay } = await import('../../server/arcade/arcade')
    const { maxEnergy } = await import('@/domain/economy/energy')
    const { baseRewardPoolCredits } = await import('@/domain/economy/reward-pool')
    const userId = await makeUser()
    await query(
      'update users set energy=$2, reward_pool=$3, reward_pool_updated_at=now(), energy_updated_at=now() where id=$1',
      [userId, maxEnergy(), baseRewardPoolCredits()],
    )
    await giveAdPass(userId)

    expect(await openArcadePlay(userId, 'boxes')).toEqual({ ok: false, reason: 'nothing_to_win' })
    /** Yang paling penting di tes ini: passnya masih utuh. Menolak SESUDAH memotong pass berarti user membayar satu tayangan iklan untuk penolakan. */
    expect(await countPasses(userId, 'ready')).toBe(1)
  })

  it('memilih energi saat stok penuh tapi energi masih ada ruang', async () => {
    configure({ arcadeEnergyPrizeWeight: 1, arcadePoolPrizeCredits: 5 })
    const { query } = await import('../../server/platform/db')
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const { baseRewardPoolCredits } = await import('@/domain/economy/reward-pool')
    const userId = await makeUser()
    await query(
      'update users set reward_pool=$2, reward_pool_updated_at=now() where id=$1',
      [userId, baseRewardPoolCredits()],
    )
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    const settled = await settleArcadePlay(userId, { playId: opened.play.id, pick: 0 })

    expect(settled.ok).toBe(true)
    if (settled.ok) expect(settled.prize.kind).toBe('energy')
  })
})

describe('ARCADE-DB-5 — satu ronde dibayar sekali', () => {
  it('menolak penyetelan kedua atas ronde yang sama', async () => {
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    expect((await settleArcadePlay(userId, { playId: opened.play.id, pick: 0 })).ok).toBe(true)
    expect(await settleArcadePlay(userId, { playId: opened.play.id, pick: 0 })).toEqual({
      ok: false,
      reason: 'unknown_play',
    })

    // Hadiah pertama tetap satu kali, tidak dua.
    expect((await readUser(userId)).pool).toBe(DEFAULT_ECONOMY_CONFIG.arcadePoolPrizeCredits)
  })

  it('menolak ronde milik user lain', async () => {
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const owner = await makeUser()
    const stranger = await makeUser()
    await giveAdPass(owner)

    const opened = await openArcadePlay(owner, 'boxes')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    expect(await settleArcadePlay(stranger, { playId: opened.play.id, pick: 0 })).toEqual({
      ok: false,
      reason: 'unknown_play',
    })
  })

  it('menolak kotak di luar papan', async () => {
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    expect(await settleArcadePlay(userId, { playId: opened.play.id, pick: 9 })).toEqual({
      ok: false,
      reason: 'bad_pick',
    })
  })
})

describe('ARCADE-DB-6 — saklar panel menutup jalur server, bukan cuma layarnya', () => {
  it('menolak pembukaan saat Arena dimatikan', async () => {
    setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
    const { openArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    expect(await openArcadePlay(userId, 'boxes')).toEqual({ ok: false, reason: 'arcade_disabled' })
    expect(await countPasses(userId, 'ready')).toBe(1)
  })
})

describe('ARCADE-DB-7 — ronde yang ditinggal', () => {
  it('mengembalikan pass iklannya, dan pass itu benar-benar bisa membayar ronde berikutnya', async () => {
    const { query } = await import('../../server/platform/db')
    const { openArcadePlay, readArcadeState } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'match')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    expect(await countPasses(userId, 'ready')).toBe(0)

    // Ditinggal lewat umurnya. Dimundurkan langsung di baris supaya tesnya tidak menunggu.
    await query("update arcade_plays set opened_at = now() - interval '1 hour' where id=$1", [
      opened.play.id,
    ])

    // Pembacaan state-lah yang menyapu ronde basi, sama seperti `EXPIRE_STALE_SQL` di jalur iklan.
    await readArcadeState(userId)
    expect(await countPasses(userId, 'ready')).toBe(1)

    /** Inti tes ini: pass yang dikembalikan harus BISA DIPAKAI. Dengan indeks unik yang tidak
     *  menyempit ke `state <> 'expired'`, langkah ini gagal — passnya kembali ke 'ready' tapi
     *  setiap upaya memakainya ditolak indeks, jadi user memegang tiket yang mati. */
    const again = await openArcadePlay(userId, 'boxes')
    expect(again.ok).toBe(true)
  })

  it('tidak mengembalikan jatah hariannya, jadi meninggalkan ronde tidak menambah tayangan', async () => {
    configure({ arcadeMaxPlaysPerDay: 1 })
    const { query } = await import('../../server/platform/db')
    const { openArcadePlay, readArcadeState } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'match')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    await query("update arcade_plays set opened_at = now() - interval '1 hour' where id=$1", [
      opened.play.id,
    ])
    await readArcadeState(userId)

    expect(await openArcadePlay(userId, 'boxes')).toEqual({ ok: false, reason: 'daily_cap' })
  })

  it('menolak penyetelan ronde yang sudah lewat umurnya', async () => {
    const { query } = await import('../../server/platform/db')
    const { openArcadePlay, settleArcadePlay } = await import('../../server/arcade/arcade')
    const userId = await makeUser()
    await giveAdPass(userId)

    const opened = await openArcadePlay(userId, 'boxes')
    if (!opened.ok) throw new Error('pembukaan ditolak')
    await query("update arcade_plays set opened_at = now() - interval '1 hour' where id=$1", [
      opened.play.id,
    ])

    expect(await settleArcadePlay(userId, { playId: opened.play.id, pick: 0 })).toEqual({
      ok: false,
      reason: 'play_expired',
    })
    expect(await readUser(userId)).toEqual({ energy: 0, pool: 0 })
  })
})
