import { beforeAll, describe, expect, it } from 'vitest'
import { PAYOUT_CHANNELS } from '@/features/withdraw/domain'
import { withdrawalMinimumCredits } from '@/domain/economy'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

async function makeUser(balance: number, activeReferrals = 5): Promise<number> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits)
     values($1,$2,$3,$4) returning id`,
    [900_000_000_000_000 + suffix, 'Uji', generateReferralCode(), balance],
  )
  const userId = Number(rows[0].id)

  for (let index = 0; index < activeReferrals; index += 1) {
    const downline = await query<{ id: string }>(
      `insert into users(telegram_id,first_name,referral_code,referred_by)
       values($1,'Referral aktif',$2,$3) returning id`,
      [900_100_000_000_000 + suffix * 10 + index, generateReferralCode(), userId],
    )
    const challenge = await query<{ id: string }>(
      `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,submitted_at,solved)
       values($1,'text','Easy','{}','\\x00',1,now(),now(),true) returning id`,
      [downline[0].id],
    )
    const completion = await query<{ id: string }>(
      `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward)
       values($1,$2,'text','Easy',1000,3,1) returning id`,
      [downline[0].id, challenge[0].id],
    )
    await query(
      `insert into referral_commissions(upline_id,downline_id,task_completion_id,reward,commission_units)
       values($1,$2,$3,1,1)`,
      [userId, downline[0].id, completion[0].id],
    )
  }

  return userId
}

const accountFor = (channel: (typeof PAYOUT_CHANNELS)[number]): string => {
  const digits = channel.digits.min
  const body = String(Math.floor(Math.random() * 10 ** (digits - 1))).padStart(digits - 1, '0')
  return `0${body}`.slice(0, digits).padEnd(digits, '7')
}

describe('gating withdrawal', () => {
  it('menolak user dengan kurang dari 5 referral aktif', async () => {
    const { createPayout } = await import('./payout')
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits, 4)

    await expect(
      createPayout(userId, {
        channelId: PAYOUT_CHANNELS[0].id,
        accountNumber: accountFor(PAYOUT_CHANNELS[0]),
        accountName: 'Uji Referral',
        credits,
      }),
    ).rejects.toMatchObject({ code: 'ACTIVE_REFERRALS_REQUIRED', status: 403 })
  })

  it('menerapkan cooldown 7 hari sejak pengajuan meskipun ditolak', async () => {
    const { createPayout, WITHDRAWAL_COOLDOWN_MS } = await import('./payout')
    const { query } = await import('./db')
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits * 2)
    const input = {
      channelId: PAYOUT_CHANNELS[0].id,
      accountNumber: accountFor(PAYOUT_CHANNELS[0]),
      accountName: 'Uji Cooldown',
      credits,
    }
    const first = await createPayout(userId, input)
    await query("update withdrawals set state='rejected',rejected_at=now(),reject_reason='Ditolak untuk tes' where id=$1", [
      first.withdrawal.id,
    ])

    await expect(createPayout(userId, input)).rejects.toMatchObject({
      code: 'WITHDRAWAL_COOLDOWN',
      status: 429,
    })

    await query('update withdrawals set requested_at=now()-($2::bigint * interval \'1 millisecond\') where id=$1', [
      first.withdrawal.id,
      WITHDRAWAL_COOLDOWN_MS + 1,
    ])
    await expect(createPayout(userId, input)).resolves.toHaveProperty('withdrawal')
  })
})

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

describe('WD-7 — satu nomor tujuan hanya untuk satu akun', () => {
  it('menolak nomor e-wallet yang sama di channel e-wallet lain', async () => {
    const { createPayout } = await import('./payout')
    const credits = withdrawalMinimumCredits()
    const dana = PAYOUT_CHANNELS.find((channel) => channel.id === 'dana')
    const gopay = PAYOUT_CHANNELS.find((channel) => channel.id === 'gopay')
    if (!dana || !gopay) throw new Error('channel e-wallet tidak ditemukan')
    const nomor = accountFor(dana)

    await createPayout(await makeUser(credits), {
      channelId: dana.id,
      accountNumber: nomor,
      accountName: 'Uji Tujuan Satu',
      credits,
    })

    await expect(
      createPayout(await makeUser(credits), {
        channelId: gopay.id,
        accountNumber: nomor,
        accountName: 'Uji Tujuan Dua',
        credits,
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NUMBER_IN_USE', status: 409 })
  })

  it('tetap mengizinkan angka yang sama di ruang nomor bank yang berbeda', async () => {
    const { createPayout } = await import('./payout')
    const credits = withdrawalMinimumCredits()
    const dana = PAYOUT_CHANNELS.find((channel) => channel.id === 'dana')
    const bca = PAYOUT_CHANNELS.find((channel) => channel.id === 'bca')
    if (!dana || !bca) throw new Error('channel tidak ditemukan')
    const nomor = accountFor(dana)

    await createPayout(await makeUser(credits), {
      channelId: dana.id,
      accountNumber: nomor,
      accountName: 'Uji Ewallet',
      credits,
    })

    await expect(
      createPayout(await makeUser(credits), {
        channelId: bca.id,
        accountNumber: nomor,
        accountName: 'Uji Bank',
        credits,
      }),
    ).resolves.toHaveProperty('withdrawal')
  })
})

describe('WD-8 — premium memakai jeda penarikan yang lebih pendek', () => {
  it('membuka pengajuan berikutnya setelah jeda premium, bukan jeda tujuh hari', async () => {
    const { createPayout } = await import('./payout')
    const { DEFAULT_ECONOMY_CONFIG } = await import('@/domain/economy-config')
    const { query } = await import('./db')
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits * 2)
    const input = {
      channelId: PAYOUT_CHANNELS[0].id,
      accountNumber: accountFor(PAYOUT_CHANNELS[0]),
      accountName: 'Uji Premium',
      credits,
    }

    const first = await createPayout(userId, input)
    await query(
      "update withdrawals set state='rejected',rejected_at=now(),reject_reason='Ditolak untuk tes' where id=$1",
      [first.withdrawal.id],
    )

    const elapsedDays = DEFAULT_ECONOMY_CONFIG.premiumWithdrawalCooldownDays + 1
    await query(
      "update withdrawals set requested_at=now()-($2::int * interval '1 day') where id=$1",
      [first.withdrawal.id, elapsedDays],
    )

    await expect(createPayout(userId, input)).rejects.toMatchObject({
      code: 'WITHDRAWAL_COOLDOWN',
      status: 429,
    })

    await query("update users set premium_until=now()+interval '30 days' where id=$1", [userId])
    await expect(createPayout(userId, input)).resolves.toHaveProperty('withdrawal')
  })
})

describe('WD-9 — kelayakan yang dibaca UI sama dengan yang diterima server', () => {
  /**
   * Jalur baca (`getPayouts`, yang menggerbang dialog penarikan) dan jalur tulis
   * (`createPayout`) pernah punya SQL kembar. Saat premium menambah jeda 3 hari, hanya
   * jalur tulis yang ikut berubah — UI menahan pembeli premium sampai hari ketujuh
   * padahal server sudah menerimanya sejak hari ketiga. Yang diuji di sini kesepakatan
   * keduanya, bukan salah satunya.
   */
  it('menutup dan membuka gerbang pada hari yang sama di kedua jalur', async () => {
    const { createPayout, getPayouts } = await import('./payout')
    const { DEFAULT_ECONOMY_CONFIG } = await import('@/domain/economy-config')
    const { query } = await import('./db')
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits * 3)
    const input = {
      channelId: PAYOUT_CHANNELS[0].id,
      accountNumber: accountFor(PAYOUT_CHANNELS[0]),
      accountName: 'Uji Sinkron',
      credits,
    }

    const first = await createPayout(userId, input)
    await query(
      "update withdrawals set state='rejected',rejected_at=now(),reject_reason='Ditolak untuk tes' where id=$1",
      [first.withdrawal.id],
    )
    const elapsedDays = DEFAULT_ECONOMY_CONFIG.premiumWithdrawalCooldownDays + 1
    await query(
      "update withdrawals set requested_at=now()-($2::int * interval '1 day') where id=$1",
      [first.withdrawal.id, elapsedDays],
    )

    const biasa = (await getPayouts(userId)).eligibility
    expect(biasa.cooldownEndsAt).not.toBeNull()
    expect(biasa.cooldownDays).toBe(7)
    await expect(createPayout(userId, input)).rejects.toMatchObject({
      code: 'WITHDRAWAL_COOLDOWN',
    })

    await query("update users set premium_until=now()+interval '30 days' where id=$1", [userId])

    const premium = (await getPayouts(userId)).eligibility
    expect(premium.cooldownDays).toBe(DEFAULT_ECONOMY_CONFIG.premiumWithdrawalCooldownDays)
    expect(premium.cooldownEndsAt).toBeNull()
    await expect(createPayout(userId, input)).resolves.toHaveProperty('withdrawal')
  })
})

describe('WD-10 — notifikasi memakai jeda efektif user, bukan angka tetap', () => {
  it('mengembalikan jeda premium dari createPayout', async () => {
    const { createPayout } = await import('./payout')
    const { DEFAULT_ECONOMY_CONFIG } = await import('@/domain/economy-config')
    const { query } = await import('./db')
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits)
    await query("update users set premium_until=now()+interval '30 days' where id=$1", [userId])

    const created = await createPayout(userId, {
      channelId: PAYOUT_CHANNELS[0].id,
      accountNumber: accountFor(PAYOUT_CHANNELS[0]),
      accountName: 'Uji Notifikasi',
      credits,
    })

    expect(created.cooldownDays).toBe(DEFAULT_ECONOMY_CONFIG.premiumWithdrawalCooldownDays)
  })

  it('mengembalikan jeda biasa untuk user tanpa premium', async () => {
    const { createPayout } = await import('./payout')
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits)

    const created = await createPayout(userId, {
      channelId: PAYOUT_CHANNELS[0].id,
      accountNumber: accountFor(PAYOUT_CHANNELS[0]),
      accountName: 'Uji Notifikasi Biasa',
      credits,
    })

    expect(created.cooldownDays).toBe(7)
  })
})
