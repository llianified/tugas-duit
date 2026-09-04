import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'

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

vi.mock('../integrations/telegram', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../integrations/telegram')>()),
  sendTelegramMessage: vi.fn(async () => undefined),
}))

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

beforeEach(() => {
  jar.clear()
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
})

async function makeUser(admin = false): Promise<{ id: number; publicId: string }> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string; public_id: string }>(
    `insert into users(telegram_id,first_name,referral_code,is_admin)
     values($1,'Uji Akses',$2,$3) returning id,public_id`,
    [String(400_000_000_000_000 + suffix), generateReferralCode(), admin],
  )
  return { id: Number(rows[0].id), publicId: rows[0].public_id }
}

async function signInAsAdmin(): Promise<{ id: number; publicId: string }> {
  const { createSession } = await import('../auth/session')
  const admin = await makeUser(true)
  jar.clear()
  await createSession(admin.id, 'uji')
  return admin
}

async function actionsOf(userId: number) {
  const { query } = await import('../platform/db')
  return query<{ action: string; reason: string; detail: Record<string, unknown> | null }>(
    'select action, reason, detail from admin_actions where target_user_id=$1 order by id desc',
    [userId],
  )
}

const flagOf = async (userId: number) => {
  const { query } = await import('../platform/db')
  const rows = await query<{ is_admin: boolean }>('select is_admin from users where id=$1', [userId])
  return rows[0].is_admin
}

describe('ADMU-1 — otorisasi', () => {
  it('menolak setiap jalur tulis tanpa sesi admin', async () => {
    const { setUserAdminFlag, setUserSuspension, updateAdminUserProfile } = await import('./admin-users')
    const target = await makeUser()

    await expect(
      setUserAdminFlag({ adminId: 0, publicId: target.publicId, isAdmin: true, reason: 'coba' }),
    ).rejects.toThrow()
    await expect(
      setUserSuspension({ adminId: 0, publicId: target.publicId, suspended: true, reason: 'coba' }),
    ).rejects.toThrow()
    await expect(
      updateAdminUserProfile({ adminId: 0, publicId: target.publicId, firstName: 'Baru', username: null }),
    ).rejects.toThrow()
  })

  it('menolak publicId yang bukan UUID tanpa menyentuh database', async () => {
    const { setUserAdminFlag, setUserSuspension, updateAdminUserProfile } = await import('./admin-users')
    const admin = await signInAsAdmin()

    expect(await setUserAdminFlag({ adminId: admin.id, publicId: 'bukan-uuid', isAdmin: true, reason: 'x' })).toBeNull()
    expect(await setUserSuspension({ adminId: admin.id, publicId: '1234', suspended: true, reason: 'x' })).toBeNull()
    expect(
      await updateAdminUserProfile({ adminId: admin.id, publicId: 'x', firstName: 'Baru', username: null }),
    ).toBeNull()
  })
})

describe('ADMU-2 — hak admin', () => {
  it('mewajibkan alasan dan mencatatnya di admin_actions', async () => {
    const { setUserAdminFlag, AdminUserError } = await import('./admin-users')
    const admin = await signInAsAdmin()
    const target = await makeUser()

    await expect(
      setUserAdminFlag({ adminId: admin.id, publicId: target.publicId, isAdmin: true, reason: '  ' }),
    ).rejects.toBeInstanceOf(AdminUserError)
    expect(await flagOf(target.id)).toBe(false)

    const hasil = await setUserAdminFlag({
      adminId: admin.id, publicId: target.publicId, isAdmin: true, reason: 'Bantu proses payout',
    })

    expect(hasil).toEqual({ isAdmin: true })
    const actions = await actionsOf(target.id)
    expect(actions[0].action).toBe('admin_grant')
    expect(actions[0].reason).toBe('Bantu proses payout')
  })

  it('mencatat pencabutan sebagai admin_revoke', async () => {
    const { setUserAdminFlag } = await import('./admin-users')
    const admin = await signInAsAdmin()
    const target = await makeUser(true)

    await setUserAdminFlag({ adminId: admin.id, publicId: target.publicId, isAdmin: false, reason: 'Selesai cuti' })

    expect(await flagOf(target.id)).toBe(false)
    expect((await actionsOf(target.id))[0].action).toBe('admin_revoke')
  })

  /** Penolakannya dilempar DI DALAM transaksi, setelah `update` berjalan. Kalau rollback-nya tidak bekerja, panel kehilangan admin terakhirnya dan pemulihannya cuma lewat shell. */
  it('menolak mencabut hak admin sendiri, dan mengembalikan flag-nya', async () => {
    const { setUserAdminFlag, AdminUserError } = await import('./admin-users')
    const admin = await signInAsAdmin()

    await expect(
      setUserAdminFlag({ adminId: admin.id, publicId: admin.publicId, isAdmin: false, reason: 'salah klik' }),
    ).rejects.toBeInstanceOf(AdminUserError)

    expect(await flagOf(admin.id)).toBe(true)
    expect(await actionsOf(admin.id)).toEqual([])
  })
})

describe('ADMU-3 — penangguhan', () => {
  it('mencabut seluruh sesi aktif dan mencatat jejaknya', async () => {
    const { setUserSuspension } = await import('./admin-users')
    const { createSession } = await import('../auth/session')
    const { query } = await import('../platform/db')
    const admin = await signInAsAdmin()
    const target = await makeUser()
    await createSession(target.id, 'perangkat target')
    jar.clear()
    await createSession(admin.id, 'uji')

    const hasil = await setUserSuspension({
      adminId: admin.id, publicId: target.publicId, suspended: true, reason: 'Dua akun satu rekening',
    })

    expect(hasil).toEqual({ suspended: true })
    const sesi = await query<{ hidup: string }>(
      'select count(*) hidup from sessions where user_id=$1 and revoked_at is null',
      [target.id],
    )
    expect(Number(sesi[0].hidup)).toBe(0)

    const actions = await actionsOf(target.id)
    expect(actions[0].action).toBe('suspend')
    expect(actions[0].reason).toBe('Dua akun satu rekening')
    expect(actions[0].detail).toMatchObject({ revokedSessions: 1 })
  })

  it('mencatat pemulihan walau alasannya tidak diminta UI', async () => {
    const { setUserSuspension } = await import('./admin-users')
    const admin = await signInAsAdmin()
    const target = await makeUser()

    await setUserSuspension({ adminId: admin.id, publicId: target.publicId, suspended: true, reason: 'sementara' })
    const hasil = await setUserSuspension({
      adminId: admin.id, publicId: target.publicId, suspended: false, reason: null,
    })

    expect(hasil).toEqual({ suspended: false })
    const actions = await actionsOf(target.id)
    expect(actions[0].action).toBe('restore')
    expect(actions[0].reason.length).toBeGreaterThan(0)
  })

  it('menolak menangguhkan akun sendiri', async () => {
    const { setUserSuspension, AdminUserError } = await import('./admin-users')
    const { query } = await import('../platform/db')
    const admin = await signInAsAdmin()

    await expect(
      setUserSuspension({ adminId: admin.id, publicId: admin.publicId, suspended: true, reason: 'salah klik' }),
    ).rejects.toBeInstanceOf(AdminUserError)

    const rows = await query<{ banned_at: Date | null }>('select banned_at from users where id=$1', [admin.id])
    expect(rows[0].banned_at).toBeNull()
  })
})

describe('ADMU-4 — override profil', () => {
  it('mencatat nilai sebelum dan sesudah', async () => {
    const { updateAdminUserProfile } = await import('./admin-users')
    const admin = await signInAsAdmin()
    const target = await makeUser()

    const hasil = await updateAdminUserProfile({
      adminId: admin.id, publicId: target.publicId, firstName: 'Nama Baru', username: '@handel_baru',
    })

    expect(hasil).toEqual({ firstName: 'Nama Baru', username: 'handel_baru' })
    const actions = await actionsOf(target.id)
    expect(actions[0].action).toBe('profile_override')
    expect(actions[0].detail).toMatchObject({
      from: { firstName: 'Uji Akses', username: null },
      to: { firstName: 'Nama Baru', username: 'handel_baru' },
    })
  })

  it('menolak username yang bukan huruf, angka, atau garis bawah', async () => {
    const { updateAdminUserProfile, AdminUserError } = await import('./admin-users')
    const admin = await signInAsAdmin()
    const target = await makeUser()

    await expect(
      updateAdminUserProfile({
        adminId: admin.id, publicId: target.publicId, firstName: 'Nama', username: 'ada spasi',
      }),
    ).rejects.toBeInstanceOf(AdminUserError)
    expect(await actionsOf(target.id)).toEqual([])
  })
})
