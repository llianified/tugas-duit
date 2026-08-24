import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy-config'
import { pickMessage, type CandidateRow } from './engagement'

vi.mock('./telegram.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./telegram')>()),
  sendTelegramMessage: vi.fn(async () => {}),
  openAppMarkup: () => ({}),
}))

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

const HOURS = 3_600_000
const NOON_WIB = new Date('2026-08-24T05:00:00Z')
const EVENING_WIB = new Date('2026-08-24T12:30:00Z')

function candidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  const now = overrides.now ?? NOON_WIB
  return {
    id: '1',
    telegram_id: '900001',
    balance_credits: '0',
    energy: DEFAULT_ECONOMY_CONFIG.maxEnergy,
    energy_updated_at: new Date(now.getTime() - 12 * HOURS),
    reward_pool: 0,
    reward_pool_updated_at: new Date(now.getTime()),
    completed_count: 10,
    completed_count_before: 10,
    last_task_at: new Date(now.getTime() - 4 * HOURS),
    tasks_today: 1,
    active_referrals: 0,
    last_withdrawal_at: null,
    processing_withdrawals: 0,
    commission_today: 0,
    new_referrals_today: 0,
    ...overrides,
    now,
  }
}

describe('ENG-1 — pesan energi penuh', () => {
  it('mengirim saat energi penuh dan user sudah lama tidak menyentuh task', () => {
    const message = pickMessage(candidate(), 0)
    expect(message?.kind).toBe('energy_full')
    expect(message?.text).toContain('Energi kamu penuh lagi')
  })

  it('diam saat user baru saja mengerjakan task', () => {
    const now = NOON_WIB
    const row = candidate({ last_task_at: new Date(now.getTime() - 30 * 60_000) })
    expect(pickMessage(row, 0)).toBeNull()
  })

  it('diam saat energi belum penuh', () => {
    const now = NOON_WIB
    const row = candidate({ energy: 0, energy_updated_at: new Date(now.getTime() - 60_000) })
    expect(pickMessage(row, 0)).toBeNull()
  })

  it('memakai tanggal WIB sebagai kunci dedup, jadi paling banyak sekali sehari', () => {
    expect(pickMessage(candidate(), 0)?.dedupeKey).toBe('2026-08-24')
  })
})

describe('ENG-2 — stok reward penuh menang atas energi penuh', () => {
  it('menyebut sisa credit yang siap diambil', () => {
    const now = NOON_WIB
    const row = candidate({
      reward_pool: 30,
      reward_pool_updated_at: new Date(now.getTime() - 24 * HOURS),
      last_task_at: new Date(now.getTime() - 8 * HOURS),
    })
    const message = pickMessage(row, 0)
    expect(message?.kind).toBe('pool_full')
    expect(message?.text).toContain('30 credit')
  })
})

describe('ENG-3 — streak hampir putus', () => {
  const eveningRow = (overrides: Partial<CandidateRow> = {}) =>
    candidate({ now: EVENING_WIB, tasks_today: 0, ...overrides })

  it('mengirim pada jam sore WIB saat hari ini belum ada task', () => {
    const message = pickMessage(eveningRow(), 4)
    expect(message?.kind).toBe('streak_risk')
    expect(message?.text).toContain('Streak 4 hari')
  })

  it('tidak mengirim kalau hari ini sudah ada task yang kelar', () => {
    expect(pickMessage(eveningRow({ tasks_today: 2 }), 4)?.kind).not.toBe('streak_risk')
  })

  it('tidak mengirim di luar jam pengingat streak', () => {
    expect(pickMessage(candidate({ tasks_today: 0 }), 4)?.kind).not.toBe('streak_risk')
  })

  it('tidak mengirim untuk rentetan yang baru satu hari', () => {
    expect(pickMessage(eveningRow(), 1)?.kind).not.toBe('streak_risk')
  })
})

describe('ENG-4 — saldo siap ditarik memakai gating yang sama dengan createPayout', () => {
  const ready = (overrides: Partial<CandidateRow> = {}) =>
    candidate({ balance_credits: '100', active_referrals: 5, ...overrides })

  it('mengirim saat semua syarat penarikan sudah terpenuhi', () => {
    const message = pickMessage(ready(), 0)
    expect(message?.kind).toBe('withdraw_ready')
    expect(message?.text).toContain('7 hari lagi')
  })

  it('diam saat referral aktifnya masih kurang', () => {
    expect(pickMessage(ready({ active_referrals: 4 }), 0)?.kind).not.toBe('withdraw_ready')
  })

  it('diam saat saldonya belum sampai batas minimal', () => {
    expect(pickMessage(ready({ balance_credits: '99' }), 0)?.kind).not.toBe('withdraw_ready')
  })

  it('diam saat masih ada pengajuan yang diproses', () => {
    expect(pickMessage(ready({ processing_withdrawals: 1 }), 0)?.kind).not.toBe('withdraw_ready')
  })

  it('diam selama cooldown 7 hari belum lewat', () => {
    const row = ready({ last_withdrawal_at: new Date(NOON_WIB.getTime() - 3 * 24 * HOURS) })
    expect(pickMessage(row, 0)?.kind).not.toBe('withdraw_ready')
  })

  it('mengirim lagi setelah cooldown lewat', () => {
    const row = ready({ last_withdrawal_at: new Date(NOON_WIB.getTime() - 8 * 24 * HOURS) })
    expect(pickMessage(row, 0)?.kind).toBe('withdraw_ready')
  })
})

describe('ENG-5 — rank naik hanya saat ambangnya baru dilewati', () => {
  it('mengirim saat 24 jam lalu rank-nya masih di bawah', () => {
    const row = candidate({ completed_count: 101, completed_count_before: 99 })
    const message = pickMessage(row, 0)
    expect(message?.kind).toBe('rank_up')
    expect(message?.dedupeKey).toBe('2')
  })

  it('tidak mengulang untuk user yang sudah lama di rank itu', () => {
    const row = candidate({ completed_count: 250, completed_count_before: 240 })
    expect(pickMessage(row, 0)?.kind).not.toBe('rank_up')
  })
})

describe('ENG-6 — winback memakai tanggal aktif terakhir sebagai kunci dedup', () => {
  it('mengirim winback 3 hari', () => {
    const row = candidate({ last_task_at: new Date(NOON_WIB.getTime() - 4 * 24 * HOURS) })
    const message = pickMessage(row, 0)
    expect(message?.kind).toBe('winback_3')
    expect(message?.dedupeKey).toBe('2026-08-20')
  })

  it('mengirim winback 7 hari untuk yang lebih lama menghilang', () => {
    const row = candidate({ last_task_at: new Date(NOON_WIB.getTime() - 9 * 24 * HOURS) })
    expect(pickMessage(row, 0)?.kind).toBe('winback_7')
  })
})

describe('ENG-7 — ringkasan komisi dan referral baru', () => {
  it('menyebut komisi hari ini dalam credit dan Rupiah', () => {
    const message = pickMessage(candidate({ commission_today: 12 }), 0)
    expect(message?.kind).toBe('commission_digest')
    expect(message?.text).toContain('12 credit (Rp1.200)')
  })

  it('menghitung teman baru yang mendaftar hari ini', () => {
    const message = pickMessage(candidate({ new_referrals_today: 3 }), 0)
    expect(message?.kind).toBe('referral_joined')
    expect(message?.text).toContain('3 teman baru')
  })
})

describe('ENG-8 — query pemindai jalan di database', () => {
  it('menerima kolom kandidat dan streak tanpa error SQL', async () => {
    const { runEngagementNotifications } = await import('./engagement')
    await expect(runEngagementNotifications()).resolves.toBeTypeOf('object')
  })
})

describe('ENG-9 — pengiriman dan penanda sekali kirim', () => {
  it('mengirim sekali lalu diam pada putaran berikutnya', async () => {
    const { query } = await import('./db')
    const { generateReferralCode } = await import('./referral')
    const { runEngagementNotifications } = await import('./engagement')

    const suffix = Math.floor(Math.random() * 1_000_000_000)
    const users = await query<{ id: string; telegram_id: string }>(
      `insert into users(telegram_id,first_name,referral_code,energy,energy_updated_at,reward_pool)
       values($1,'Penerima',$2,$3,now()-interval '2 days',0) returning id,telegram_id`,
      [610_000_000_000_000 + suffix, generateReferralCode(), DEFAULT_ECONOMY_CONFIG.maxEnergy],
    )
    const userId = Number(users[0].id)
    const challenge = await query<{ id: string }>(
      `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,submitted_at,solved)
       values($1,'text','Easy','{}','\\x00',1,now(),now(),true) returning id`,
      [userId],
    )
    await query(
      `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
       values($1,$2,'text','Easy',1000,3,1,now()-interval '2 days')`,
      [userId, challenge[0].id],
    )

    const noonWib = new Date('2026-08-24T05:00:00Z')
    await runEngagementNotifications({ now: noonWib })
    const first = await query<{ kind: string }>(
      'select kind from bot_notifications where user_id=$1',
      [userId],
    )
    expect(first.map((row) => row.kind)).toEqual(['energy_full'])

    await runEngagementNotifications({ now: noonWib })
    const second = await query<{ count: string }>(
      'select count(*) from bot_notifications where user_id=$1',
      [userId],
    )
    expect(Number(second[0].count)).toBe(1)
  })

  it('melewati user yang menekan /stop', async () => {
    const { query } = await import('./db')
    const { generateReferralCode } = await import('./referral')
    const { runEngagementNotifications } = await import('./engagement')

    const suffix = Math.floor(Math.random() * 1_000_000_000)
    const users = await query<{ id: string }>(
      `insert into users(telegram_id,first_name,referral_code,energy,energy_updated_at,notifications_muted_at)
       values($1,'Bisu',$2,$3,now()-interval '2 days',now()) returning id`,
      [620_000_000_000_000 + suffix, generateReferralCode(), DEFAULT_ECONOMY_CONFIG.maxEnergy],
    )
    const userId = Number(users[0].id)
    const challenge = await query<{ id: string }>(
      `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,submitted_at,solved)
       values($1,'text','Easy','{}','\\x00',1,now(),now(),true) returning id`,
      [userId],
    )
    await query(
      `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
       values($1,$2,'text','Easy',1000,3,1,now()-interval '2 days')`,
      [userId, challenge[0].id],
    )

    await runEngagementNotifications({ now: new Date('2026-08-24T05:00:00Z') })
    const sent = await query<{ count: string }>(
      'select count(*) from bot_notifications where user_id=$1',
      [userId],
    )
    expect(Number(sent[0].count)).toBe(0)
  })
})
