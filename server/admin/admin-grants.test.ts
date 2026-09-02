import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy-config'

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
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

beforeEach(() => {
  jar.clear()
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
})

async function makeUser(admin = false): Promise<{ id: number; publicId: string }> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string; public_id: string }>(
    `insert into users(telegram_id,first_name,referral_code,is_admin,energy,energy_updated_at)
     values($1,'Uji Hibah',$2,$3,0,now()) returning id,public_id`,
    [String(300_000_000_000_000 + suffix), generateReferralCode(), admin],
  )
  return { id: Number(rows[0].id), publicId: rows[0].public_id }
}

async function signInAsAdmin(): Promise<number> {
  const { createSession } = await import('./session')
  const admin = await makeUser(true)
  jar.clear()
  await createSession(admin.id, 'uji')
  return admin.id
}

const premiumUntil = async (userId: number) => {
  const { query } = await import('./db')
  const rows = await query<{ premium_until: Date | null }>(
    'select premium_until from users where id=$1',
    [userId],
  )
  return rows[0].premium_until
}

describe('otorisasi', () => {
  it('menolak tanpa sesi admin', async () => {
    const { grantUserPremium } = await import('./admin-grants')
    const target = await makeUser()
    await expect(
      grantUserPremium({ adminId: 0, publicId: target.publicId, days: 7, reason: 'uji' }),
    ).rejects.toThrow()
  })

  it('menolak user biasa yang sudah punya sesi', async () => {
    const { createSession } = await import('./session')
    const { grantUserPremium } = await import('./admin-grants')
    const biasa = await makeUser(false)
    jar.clear()
    await createSession(biasa.id, 'uji')
    const target = await makeUser()
    await expect(
      grantUserPremium({ adminId: biasa.id, publicId: target.publicId, days: 7, reason: 'uji' }),
    ).rejects.toThrow()
  })
})

describe('GRANT-1 — premium dari panel menumpuk, tidak menimpa', () => {
  it('menambah dari hari ini untuk akun yang belum premium', async () => {
    const adminId = await signInAsAdmin()
    const { grantUserPremium } = await import('./admin-grants')
    const target = await makeUser()

    const result = await grantUserPremium({
      adminId,
      publicId: target.publicId,
      days: 30,
      reason: 'Hadiah giveaway',
    })

    expect(result?.active).toBe(true)
    const until = await premiumUntil(target.id)
    const selisihHari = (until!.getTime() - Date.now()) / 86_400_000
    expect(selisihHari).toBeGreaterThan(29)
    expect(selisihHari).toBeLessThan(31)
  })

  /** Inti keputusannya: pemberian admin tidak boleh memotong hari yang sudah DIBAYAR user. Bentuk "menimpa tanggal berakhir" akan memangkas langganan 90 hari jadi 7 hanya karena admin memberi bonus seminggu. */
  it('menumpuk di atas langganan berbayar yang masih berjalan', async () => {
    const { query } = await import('./db')
    const adminId = await signInAsAdmin()
    const { grantUserPremium } = await import('./admin-grants')
    const target = await makeUser()

    await query(
      "update users set premium_until = now() + interval '90 days' where id=$1",
      [target.id],
    )
    const sebelum = await premiumUntil(target.id)

    await grantUserPremium({
      adminId,
      publicId: target.publicId,
      days: 7,
      reason: 'Kompensasi gangguan',
    })

    const sesudah = await premiumUntil(target.id)
    const tambahanHari = (sesudah!.getTime() - sebelum!.getTime()) / 86_400_000
    expect(tambahanHari).toBeGreaterThan(6.9)
    expect(tambahanHari).toBeLessThan(7.1)
  })

  it('mencabut premium dan menyimpan tanggal lamanya di jejak audit', async () => {
    const { query } = await import('./db')
    const adminId = await signInAsAdmin()
    const { grantUserPremium, revokeUserPremium, readAdminActions } = await import(
      './admin-grants'
    )
    const target = await makeUser()

    await grantUserPremium({ adminId, publicId: target.publicId, days: 30, reason: 'uji beri' })
    const sebelum = await premiumUntil(target.id)

    const revoked = await revokeUserPremium({
      adminId,
      publicId: target.publicId,
      reason: 'Salah orang',
    })

    expect(revoked).toEqual({ premiumUntil: null, active: false })
    expect(await premiumUntil(target.id)).toBeNull()

    const actions = await readAdminActions(target.id)
    const cabut = actions.find((entry) => entry.action === 'premium_revoke')
    expect(cabut?.reason).toBe('Salah orang')
    expect(cabut?.detail?.sebelum).toBe(sebelum!.toISOString())

    const rows = await query<{ total: string }>(
      'select count(*) total from admin_actions where target_user_id=$1',
      [target.id],
    )
    expect(Number(rows[0].total)).toBe(2)
  })
})

describe('GRANT-2 — alasan wajib, jumlah dijepit', () => {
  it('menolak aksi tanpa alasan', async () => {
    const adminId = await signInAsAdmin()
    const { grantUserPremium } = await import('./admin-grants')
    const target = await makeUser()

    await expect(
      grantUserPremium({ adminId, publicId: target.publicId, days: 7, reason: '   ' }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED', status: 400 })
  })

  it('menolak jumlah nol, negatif, dan di atas batas', async () => {
    const adminId = await signInAsAdmin()
    const { grantUserEnergy } = await import('./admin-grants')
    const target = await makeUser()

    for (const amount of [0, -1, 11]) {
      await expect(
        grantUserEnergy({ adminId, publicId: target.publicId, amount, reason: 'uji' }),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
    }
  })

  /** Energi dijepit di kapasitas, sama seperti jalur user biasa — `users_energy_range` mematok 0..10 di database, dan `applyEnergyGrant` memotong di `maxEnergy()`. Yang diuji di sini adalah bahwa panel tidak punya jalan memutar untuk melewatinya. */
  it('menjepit energi di kapasitas, bukan menembusnya', async () => {
    const adminId = await signInAsAdmin()
    const { grantUserEnergy } = await import('./admin-grants')
    const { maxEnergy } = await import('@/domain/energy')
    const target = await makeUser()

    const result = await grantUserEnergy({
      adminId,
      publicId: target.publicId,
      amount: 10,
      reason: 'Kompensasi',
    })

    expect(result?.energy).toBe(maxEnergy())
    expect(result?.max).toBe(maxEnergy())
  })

  it('menjepit stok reward di kapasitas kolam user', async () => {
    const adminId = await signInAsAdmin()
    const { refillUserRewardPool } = await import('./admin-grants')
    const { query } = await import('./db')
    const target = await makeUser()

    await query('update users set reward_pool=0, reward_pool_updated_at=now() where id=$1', [
      target.id,
    ])

    const result = await refillUserRewardPool({
      adminId,
      publicId: target.publicId,
      credits: 10_000,
      reason: 'Kompensasi gangguan',
    })

    expect(result?.credits).toBe(result?.capacity)
  })
})

describe('GRANT-3 — penanda notifikasi dan gerbang channel', () => {
  it('membuka bisu yang dipasang /stop', async () => {
    const { query } = await import('./db')
    const adminId = await signInAsAdmin()
    const { setUserNotificationsMuted } = await import('./admin-grants')
    const target = await makeUser()

    await query('update users set notifications_muted_at=now() where id=$1', [target.id])

    const result = await setUserNotificationsMuted({
      adminId,
      publicId: target.publicId,
      muted: false,
      reason: 'User minta dinyalakan lagi',
    })

    expect(result).toEqual({ muted: false })
  })

  it('menghapus hasil pemeriksaan channel yang tersimpan', async () => {
    const { query } = await import('./db')
    const adminId = await signInAsAdmin()
    const { resetUserChannelGate } = await import('./admin-grants')
    const target = await makeUser()

    await query(
      'update users set channel_member=true, channel_checked_at=now() where id=$1',
      [target.id],
    )

    expect(
      await resetUserChannelGate({
        adminId,
        publicId: target.publicId,
        reason: 'User lapor tertahan gerbang',
      }),
    ).toEqual({ reset: true })

    const rows = await query<{ channel_member: boolean | null; channel_checked_at: Date | null }>(
      'select channel_member, channel_checked_at from users where id=$1',
      [target.id],
    )
    expect(rows[0].channel_member).toBeNull()
    expect(rows[0].channel_checked_at).toBeNull()
  })
})
