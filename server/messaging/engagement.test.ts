import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'
import { pickMessage, type CandidateRow } from './engagement'

vi.mock('../integrations/telegram.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../integrations/telegram')>()),
  sendTelegramMessage: vi.fn(async () => {}),
  openAppMarkup: () => ({}),
}))

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
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
    premium_until: null,
    completed_count: 10,
    completed_count_before: 10,
    last_task_at: new Date(now.getTime() - 4 * HOURS),
    tasks_today: 1,
    tasks_recent: 1,
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
  it('menyebut sisa TD yang siap diambil', () => {
    const now = NOON_WIB
    const row = candidate({
      reward_pool: 30,
      reward_pool_updated_at: new Date(now.getTime() - 24 * HOURS),
      last_task_at: new Date(now.getTime() - 8 * HOURS),
    })
    const message = pickMessage(row, 0)
    expect(message?.kind).toBe('pool_full')
    expect(message?.text).toContain('30 TD')
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

  // Kalau gating di sini tertinggal dari `createPayout`, bot mengajak user menarik lalu | server menolaknya — kegagalan yang paling merusak kepercayaan di jalur uang.
  it('diam saat hari aktifnya masih kurang', () => {
    expect(pickMessage(ready({ active_referrals: 0 }), 0)?.kind).not.toBe('withdraw_ready')
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
  it('menyebut komisi hari ini dalam TD dan Rupiah', () => {
    const message = pickMessage(candidate({ commission_today: 12 }), 0)
    expect(message?.kind).toBe('commission_digest')
    expect(message?.text).toContain('12 TD (Rp1.200)')
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
    const { query } = await import('../platform/db')
    const { generateReferralCode } = await import('../economy/referral')
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
    const { query } = await import('../platform/db')
    const { generateReferralCode } = await import('../economy/referral')
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

describe('ENG-10 — kebijakan pemuatan config sama dengan jalur request', () => {
  /** `loadEconomyConfig` (jalur request) memakai `fillMissing: true`, dan itu jaring pengaman yang sengaja dipasang untuk jendela "kode baru sudah live, migrasinya belum jalan". Pemuat lokal di `engagement.ts` sempat tidak memakainya, jadi di jendela yang sama aplikasi tetap melayani dengan nilai bawaan sementara SELURUH pesan bot berhenti — dan berhentinya diam, karena `runMaintenance` menerima `{}` sebagai hasil yang sah, bukan sebagai error. */
  it('memakai nilai bawaan untuk key yang belum ada di baris tersimpan, bukan berhenti mengirim', async () => {
    const { query } = await import('../platform/db')
    const { generateReferralCode } = await import('../economy/referral')
    const { runEngagementNotifications } = await import('./engagement')

    const suffix = Math.floor(Math.random() * 1_000_000_000)
    const users = await query<{ id: string }>(
      `insert into users(telegram_id,first_name,referral_code,energy,energy_updated_at,reward_pool)
       values($1,'Config',$2,$3,now()-interval '2 days',0) returning id`,
      [630_000_000_000_000 + suffix, generateReferralCode(), DEFAULT_ECONOMY_CONFIG.maxEnergy],
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

    // Baris config kehilangan satu key, persis seperti deploy yang mendahului migrasinya.
    await query("update economy_config set config = config - 'missionAdsReward' where id=1")
    try {
      await runEngagementNotifications({ now: new Date('2026-08-24T05:00:00Z') })

      const sent = await query<{ kind: string }>(
        'select kind from bot_notifications where user_id=$1',
        [userId],
      )
      expect(sent.map((row) => row.kind)).toEqual(['energy_full'])
    } finally {
      await query(
        `update economy_config
            set config = config || jsonb_build_object('missionAdsReward', $1::int)
          where id=1`,
        [DEFAULT_ECONOMY_CONFIG.missionAdsReward],
      )
    }
  })
})

/** P2-04: kueri kandidat pernah tanpa `limit` dan tanpa `order by`. Tanpa `limit` ia melewati `maxDuration = 60` begitu basis user tumbuh, dan lambda dibunuh sebelum satu pesan pun terkirim — sementara `runMaintenance` tetap melaporkan sukses. Tanpa `order by` himpunan yang dilayani ditentukan urutan pemindaian Postgres, jadi user yang sama tidak pernah kebagian. Keduanya tidak terlihat dari hasil test mana pun: yang bisa menahannya cuma membaca kueri itu sendiri. */
describe('ENG-11 — kueri kandidat berbatas dan berurutan', () => {
  it('membawa limit dan order by', async () => {
    const { readFile } = await import('node:fs/promises')
    const path = await import('node:path')
    const source = await readFile(
      path.join(process.cwd(), 'server/messaging/engagement.ts'),
      'utf8',
    )
    const sql = /const CANDIDATE_SQL = `([\s\S]*?)`/.exec(source)?.[1] ?? ''

    expect(sql).not.toBe('')
    expect(sql).toMatch(/\border by\b/)
    expect(sql).toMatch(/\blimit \$1\b/)
  })

  it('membayar subquery mahalnya hanya untuk kandidat yang sudah dipotong', async () => {
    const { readFile } = await import('node:fs/promises')
    const path = await import('node:path')
    const source = await readFile(
      path.join(process.cwd(), 'server/messaging/engagement.ts'),
      'utf8',
    )
    const sql = /const CANDIDATE_SQL = `([\s\S]*?)`/.exec(source)?.[1] ?? ''
    const setelahPotong = sql.slice(sql.indexOf('limit $1'))

    // Seluruh subquery berkorelasi berdiri di atas `picked`, bukan di atas `users`.
    expect(setelahPotong).toMatch(/from picked p/)
    expect(setelahPotong).not.toMatch(/tc\.user_id=u\.id/)
  })
})

/** ENG-12 — jenis pesan baru, dan satu aturan yang berlaku untuk semuanya: setiap pesan menutup
 * dengan ajakan main yang konkret.
 *
 * Cron-nya jalan sekali sehari, jadi satu user paling banyak menerima SATU pesan per hari. Itu yang
 * membuat urutan di `pickMessage` menentukan segalanya — jenis yang kalah urutan bukan "muncul
 * nanti", melainkan tidak pernah muncul untuk user itu hari itu. */
describe('ENG-12 — ajakan main dan jenis pesan baru', () => {
  /** Misi harian DIUNDI tiap hari (migrasi 0048), jadi "Selesaikan soal" belum tentu keluar. Undian
   * dilebarkan sampai seluruh misi otomatis terpilih supaya yang diuji aturannya, bukan hasil
   * undian tanggal tertentu. */
  const semuaMisi = () =>
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, missionDailyCount: 20 })

  it('mengingatkan misi harian yang tinggal sedikit, bukan yang baru dimulai', () => {
    semuaMisi()
    const target = DEFAULT_ECONOMY_CONFIG.missionTasksTarget

    const nyaris = pickMessage(candidate({ tasks_today: target - 1 }), 0)
    expect(nyaris?.kind).toBe('mission_ready')
    expect(nyaris?.text).toContain('tinggal 1 soal')

    /** Empat soal lagi bukan ajakan, cuma laporan — dan laporan menghabiskan satu-satunya jatah
     * kirim hari itu tanpa memindahkan siapa pun. */
    expect(pickMessage(candidate({ tasks_today: 1 }), 0)?.kind).not.toBe('mission_ready')
  })

  it('tidak menyebut misi yang tidak keluar hari itu', () => {
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, missionDailyCount: 0 })
    const target = DEFAULT_ECONOMY_CONFIG.missionTasksTarget
    expect(pickMessage(candidate({ tasks_today: target - 1 }), 0)?.kind).not.toBe('mission_ready')
  })

  /** 2026-01-11 adalah hari terakhir musim pertama sejak `SEASON_ANCHOR` (2026-01-05, musim 7
   * hari). Tanggalnya dipilih dari aturannya, bukan dari hari ini, supaya uji ini tidak berubah
   * hasil besok. */
  it('mengabari musim papan peringkat yang habis malam ini, hanya untuk yang ikut', () => {
    const akhirMusim = new Date('2026-01-11T05:00:00Z')
    const ikut = candidate({ now: akhirMusim, tasks_today: 0, tasks_recent: 12, energy: 0 })
    expect(pickMessage(ikut, 0)?.kind).toBe('season_ending')

    const tidakIkut = candidate({ now: akhirMusim, tasks_today: 0, tasks_recent: 0, energy: 0 })
    expect(pickMessage(tidakIkut, 0)?.kind).not.toBe('season_ending')
  })

  /** Ajakan belanja: saldo yang cukup buat beli sesuatu tapi penarikannya belum kebuka. Kunci
   * dedup-nya mingguan — ajakan belanja yang datang tiap hari berhenti jadi ajakan. */
  it('menawarkan toko untuk saldo yang belum bisa ditarik, dengan dedup mingguan', () => {
    const message = pickMessage(candidate({ tasks_today: 0, balance_credits: '50' }), 0)

    expect(message?.kind).toBe('store_idle')
    expect(message?.dedupeKey.startsWith('W')).toBe(true)
    expect(message?.text).toContain('QRIS')
  })

  it('tidak menawarkan toko saat saldonya belum cukup buat beli apa pun', () => {
    expect(pickMessage(candidate({ tasks_today: 0, balance_credits: '1' }), 0)?.kind).not.toBe(
      'store_idle',
    )
  })

  /** Jaring terakhir. Tanpa ini user yang hari ini belum menyentuh soal — tapi energinya belum
   * penuh, stoknya belum penuh, streak-nya belum dua hari — tidak menerima satu pun ajakan main,
   * padahal ia persis orang yang paling mudah diajak balik. */
  it('tetap mengajak main user yang hari ini belum kelar satu soal pun', () => {
    const row = candidate({
      tasks_today: 0,
      energy: 1,
      last_task_at: new Date(NOON_WIB.getTime() - 1 * HOURS),
    })

    expect(pickMessage(row, 0)?.kind).toBe('daily_invite')
  })

  it('diam untuk user yang hari ini memang sudah main dan tidak punya kabar lain', () => {
    const row = candidate({
      tasks_today: 2,
      energy: 1,
      last_task_at: new Date(NOON_WIB.getTime() - 1 * HOURS),
    })

    expect(pickMessage(row, 0)).toBeNull()
  })

  /** Yang diuji bukan kalimatnya, melainkan bahwa tidak ada jenis pesan yang berhenti sebagai
   * laporan keadaan. Tiap pesan harus punya tombol yang menyebut aksinya — "buka app" yang dulu
   * dipakai bergantian sudah tidak dihitung sebagai ajakan. */
  it('memberi setiap jenis pesan tombol yang menyebut aksinya', () => {
    semuaMisi()
    const target = DEFAULT_ECONOMY_CONFIG.missionTasksTarget
    const rows: CandidateRow[] = [
      candidate({ tasks_today: target - 1 }),
      candidate({ commission_today: 5, tasks_today: 1 }),
      candidate({ new_referrals_today: 2, tasks_today: 1 }),
      candidate({ tasks_today: 0, balance_credits: '50' }),
      candidate({ tasks_today: 0, energy: 1, last_task_at: new Date(NOON_WIB.getTime() - HOURS) }),
      candidate({ last_task_at: new Date(NOON_WIB.getTime() - 5 * 24 * HOURS), tasks_today: 0 }),
    ]

    const messages = rows.map((row) => pickMessage(row, 0))
    expect(messages.every((message) => message !== null)).toBe(true)
    for (const message of messages) {
      expect(message?.buttonLabel).toBeTruthy()
      expect(message?.buttonLabel).not.toBe('🎮 Buka app')
      expect(message?.text.length).toBeGreaterThan(40)
    }
  })
})
