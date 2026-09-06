import { beforeAll, describe, expect, it } from 'vitest'
import { PAYOUT_CHANNELS } from '@/domain/economy/withdrawal'
import { withdrawalMinimumCredits } from '@/domain/economy/economy'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

async function makeUser(balance: number, activeReferrals = 5, activeDays?: number): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const { seedActiveDays, seedActiveReferrals } = await import('../__fixtures__/payout')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,balance_credits)
     values($1,$2,$3,$4) returning id`,
    [900_000_000_000_000 + suffix, 'Uji', generateReferralCode(), balance],
  )
  const userId = Number(rows[0].id)

  await seedActiveReferrals(userId, activeReferrals)
  await seedActiveDays(userId, activeDays)

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
    const { createPayout, withdrawalCooldownMsForBase } = await import('./payout')
    const { query } = await import('../platform/db')
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
      withdrawalCooldownMsForBase() + 1,
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

/** Kebalikan WD-6: yang dijaga di sini bukan "channel di kode diterima database", melainkan "channel di database tidak berbohong di layar". Keduanya perlu karena keduanya pernah berselisih ke arah yang berbeda. */
describe('WD-6b — channel di luar daftar tidak pernah menyamar jadi channel lain', () => {
  it('AUDIT-H2 — memakai id-nya sendiri sebagai nama, bukan channel pertama', async () => {
    const { getPayoutChannel, PAYOUT_CHANNELS } = await import('@/domain/economy/withdrawal')

    /** `withdrawals_known_channel` masih menerima `bri` dan `mandiri` dari masa keduanya ditawarkan. Bentuk lama `getPayoutChannel` jatuh ke `PAYOUT_CHANNELS[0]`, jadi baris lama itu terbaca sebagai DANA di antrean payout — label yang dibaca admin tepat sebelum mentransfer — dan di pesan Telegram ke user. */
    for (const legacy of ['bri', 'mandiri']) {
      const channel = getPayoutChannel(legacy)
      expect(channel.id).toBe(legacy)
      expect(channel.name).toBe(legacy.toUpperCase())
      expect(channel.name).not.toBe(PAYOUT_CHANNELS[0].name)
    }
  })

  it('tetap mengembalikan channel yang sesungguhnya untuk id yang dikenal', async () => {
    const { getPayoutChannel, PAYOUT_CHANNELS } = await import('@/domain/economy/withdrawal')

    for (const channel of PAYOUT_CHANNELS) {
      expect(getPayoutChannel(channel.id)).toBe(channel)
    }
  })
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
    const { DEFAULT_ECONOMY_CONFIG } = await import('@/domain/economy/economy-config')
    const { query } = await import('../platform/db')
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
  /** Jalur baca (`getPayouts`, yang menggerbang dialog penarikan) dan jalur tulis (`createPayout`) pernah punya SQL kembar. Saat premium menambah jeda 3 hari, hanya jalur tulis yang ikut berubah — UI menahan pembeli premium sampai hari ketujuh padahal server sudah menerimanya sejak hari ketiga. Yang diuji di sini kesepakatan keduanya, bukan salah satunya. */
  it('menutup dan membuka gerbang pada hari yang sama di kedua jalur', async () => {
    const { createPayout, getPayouts } = await import('./payout')
    const { DEFAULT_ECONOMY_CONFIG } = await import('@/domain/economy/economy-config')
    const { query } = await import('../platform/db')
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
    const { DEFAULT_ECONOMY_CONFIG } = await import('@/domain/economy/economy-config')
    const { query } = await import('../platform/db')
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

/** Gerbang hari aktif dicabut dan digantikan premium. Yang dijaga di sini bukan cuma penolakannya,
 * tapi juga bahwa syaratnya BISA DIMATIKAN dari panel — gerbang berbayar yang tidak bisa dibuka
 * lagi tanpa deploy adalah gerbang yang tidak akan pernah berani disetel. */
describe('WD-11 — syarat premium sebelum penarikan', () => {
  const input = () => ({
    channelId: PAYOUT_CHANNELS[0].id,
    accountNumber: accountFor(PAYOUT_CHANNELS[0]),
    accountName: 'Uji Premium',
    credits: withdrawalMinimumCredits(),
  })

  const withPremiumRequired = async <T,>(run: () => Promise<T>): Promise<T> => {
    const { setActiveEconomyConfig, economyConfig } = await import('@/domain/economy/economy-config')
    const before = economyConfig()
    setActiveEconomyConfig({ ...before, withdrawalRequiresPremium: 1 })
    try {
      return await run()
    } finally {
      setActiveEconomyConfig(before)
    }
  }

  it('menolak user yang syaratnya lengkap tapi belum premium', async () => {
    const { createPayout } = await import('./payout')
    const userId = await makeUser(withdrawalMinimumCredits(), 5)

    await withPremiumRequired(async () => {
      await expect(createPayout(userId, input())).rejects.toMatchObject({
        code: 'PREMIUM_REQUIRED',
        status: 403,
      })
    })
  })

  it('menerima begitu premiumnya aktif', async () => {
    const { seedPremium } = await import('../__fixtures__/payout')
    const { createPayout } = await import('./payout')
    const userId = await makeUser(withdrawalMinimumCredits(), 5)
    await seedPremium(userId)

    await withPremiumRequired(async () => {
      await expect(createPayout(userId, input())).resolves.toHaveProperty('withdrawal')
    })
  })

  it('membuka penarikan lagi saat syaratnya dimatikan dari panel', async () => {
    const { createPayout } = await import('./payout')
    const userId = await makeUser(withdrawalMinimumCredits(), 5)

    await expect(createPayout(userId, input())).resolves.toHaveProperty('withdrawal')
  })

  /** Daftar syarat yang dibaca UI harus menyebut keadaan yang sama dengan yang ditegakkan server.
   * Kalau keduanya berbeda, user melihat checklist yang lengkap lalu ditolak di ujung — persis
   * bentuk kegagalan yang daftar ini ada untuk mencegahnya. */
  it('melaporkan syarat premium apa adanya ke UI', async () => {
    const { getPayouts } = await import('./payout')
    const userId = await makeUser(withdrawalMinimumCredits(), 5)

    const mati = (await getPayouts(userId)).eligibility
    expect(mati.requiresPremium).toBe(false)
    expect(mati.premiumActive).toBe(false)

    await withPremiumRequired(async () => {
      const nyala = (await getPayouts(userId)).eligibility
      expect(nyala.requiresPremium).toBe(true)
      expect(nyala.premiumActive).toBe(false)
    })
  })
})

describe('WD-12 — bukti transfer', () => {
  const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
  const png = () =>
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])

  const asFile = (bytes: Uint8Array, type: string, name = 'bukti') =>
    new File([bytes as unknown as BlobPart], name, { type })

  it('menerima JPEG dan PNG asli', async () => {
    const { readPayoutProof } = await import('./payout-proof')

    await expect(readPayoutProof(asFile(jpeg(), 'image/jpeg'))).resolves.toMatchObject({
      ok: true,
      proof: { contentType: 'image/jpeg', fileName: 'bukti-transfer.jpg' },
    })
    await expect(readPayoutProof(asFile(png(), 'image/png'))).resolves.toMatchObject({
      ok: true,
      proof: { contentType: 'image/png', fileName: 'bukti-transfer.png' },
    })
  })

  it('menolak berkas yang bukan gambar walau mime-nya mengaku gambar', async () => {
    const { readPayoutProof } = await import('./payout-proof')
    const bytes = new TextEncoder().encode('%PDF-1.7 bukan gambar')

    await expect(readPayoutProof(asFile(bytes, 'image/png'))).resolves.toMatchObject({ ok: false })
  })

  it('menolak mime yang tidak cocok dengan isi berkasnya', async () => {
    const { readPayoutProof } = await import('./payout-proof')

    await expect(readPayoutProof(asFile(jpeg(), 'image/png'))).resolves.toMatchObject({ ok: false })
  })

  it('menolak berkas kosong dan berkas di atas 5 MB', async () => {
    const { readPayoutProof } = await import('./payout-proof')
    const { PAYOUT_PROOF_MAX_BYTES } = await import('@/domain/economy/withdrawal')
    const besar = new Uint8Array(PAYOUT_PROOF_MAX_BYTES + 1)
    besar.set(jpeg())

    await expect(readPayoutProof(asFile(new Uint8Array(0), 'image/png'))).resolves.toMatchObject({
      ok: false,
    })
    await expect(readPayoutProof(asFile(besar, 'image/jpeg'))).resolves.toMatchObject({ ok: false })
  })

  it('hasProof mengikuti kolom bukti tanpa membocorkan file_id', async () => {
    const { query } = await import('../platform/db')
    const { createPayout, getPayouts, savePayoutProof } = await import('./payout')
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits)

    const created = await createPayout(userId, {
      channelId: PAYOUT_CHANNELS[0].id,
      accountNumber: accountFor(PAYOUT_CHANNELS[0]),
      accountName: 'Uji Bukti',
      credits,
    })
    const id = created.withdrawal.id

    expect((await getPayouts(userId)).withdrawals[0]).toMatchObject({ hasProof: false })

    await savePayoutProof(id, 'file-id-uji')
    expect((await getPayouts(userId)).withdrawals[0].hasProof).toBe(false)

    await query("update withdrawals set state='paid',paid_at=now() where id=$1", [id])
    await savePayoutProof(id, 'file-id-uji')

    const withdrawal = (await getPayouts(userId)).withdrawals[0]
    expect(withdrawal.hasProof).toBe(true)
    expect(JSON.stringify(withdrawal)).not.toContain('file-id-uji')
  })
})

/** WD-11 — Tarik Sekarang melepas jeda sekali, lalu habis sendiri.
 *
 * Penandanya waktu, bukan jatah yang dicacah, dan itu yang membuatnya tidak bisa menggantung:
 * begitu pengajuan berikutnya masuk, `requested_at` melewati penandanya dan gerbangnya menutup
 * lagi. Yang dijaga di sini bahwa ia BENAR-BENAR sekali — jatah yang diam-diam berlaku selamanya
 * berarti satu pembelian membuka penarikan tanpa batas. */
describe('WD-13 — pelepas jeda penarikan yang dibeli di toko', () => {
  it('membuka satu pengajuan lalu kembali menahan yang berikutnya', async () => {
    const { createPayout, getPayouts } = await import('./payout')
    const { query } = await import('../platform/db')
    const credits = withdrawalMinimumCredits()
    const userId = await makeUser(credits * 3)
    const input = {
      channelId: PAYOUT_CHANNELS[0].id,
      accountNumber: accountFor(PAYOUT_CHANNELS[0]),
      accountName: 'Uji Lepas Jeda',
      credits,
    }

    const first = await createPayout(userId, input)
    await query(
      "update withdrawals set state='rejected',rejected_at=now(),reject_reason='Ditolak untuk tes' where id=$1",
      [first.withdrawal.id],
    )

    const tertahan = (await getPayouts(userId)).eligibility
    expect(tertahan.cooldownEndsAt).not.toBeNull()
    expect(tertahan.cooldownWaived).toBe(false)

    await query('update users set withdrawal_cooldown_waived_at=now() where id=$1', [userId])

    const terlepas = (await getPayouts(userId)).eligibility
    expect(terlepas.cooldownEndsAt).toBeNull()
    expect(terlepas.cooldownWaived).toBe(true)

    const second = await createPayout(userId, input)
    await query(
      "update withdrawals set state='rejected',rejected_at=now(),reject_reason='Ditolak untuk tes' where id=$1",
      [second.withdrawal.id],
    )

    /** Pengajuan kedua sudah memakai jatahnya: penandanya kini lebih tua daripada
     * `requested_at`, jadi gerbangnya menutup lagi tanpa satu pun langkah konsumsi terpisah. */
    const lagi = (await getPayouts(userId)).eligibility
    expect(lagi.cooldownWaived).toBe(false)
    expect(lagi.cooldownEndsAt).not.toBeNull()
    await expect(createPayout(userId, input)).rejects.toMatchObject({
      code: 'WITHDRAWAL_COOLDOWN',
    })
  })
})
