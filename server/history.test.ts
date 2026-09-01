import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy-config'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
  setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG)
}, 120_000)

async function makeUser(): Promise<number> {
  const { query } = await import('./db')
  const { generateReferralCode } = await import('./referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code)
     values($1,'Uji Riwayat',$2) returning id`,
    [String(900_000_000_000_000 + suffix), generateReferralCode()],
  )
  return Number(rows[0].id)
}

/**
 * Menyelesaikan task pada waktu yang ditentukan sampai mikrodetik. Waktunya dikirim sebagai
 * teks, bukan `Date`, justru karena `Date` yang tidak bisa membawa mikrodetik — itu inti
 * kasus yang diuji di bawah.
 */
async function completeAt(userId: number, completedAt: string) {
  const { query } = await import('./db')
  const challengeId = (await query<{ id: string }>('select gen_random_uuid() id'))[0].id
  await query(
    `insert into challenges(id,user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,started_at,submitted_at,solved)
     values($1,$2,'text','Easy','{}'::jsonb,decode('00','hex'),3,now(),now(),now(),true)`,
    [challengeId, userId],
  )
  await query(
    `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
     values($1,$2,'text','Easy',5000,3,1,$3::timestamptz)`,
    [userId, challengeId, completedAt],
  )
}

describe('HIST-1 — paginasi riwayat tidak menjatuhkan baris', () => {
  it('AUDIT-L2 — memuat baris yang jatuh di milidetik yang sama dengan batas halaman', async () => {
    const { getHistoryPage, parseHistoryCursor } = await import('./history')
    const userId = await makeUser()

    /**
     * 29 baris terbaru mengisi halaman pertama hampir penuh, lalu TIGA baris di dalam satu
     * milidetik yang sama (…:00.500) menjatuhkan batas halaman tepat di tengah kelompok itu.
     *
     * Di situlah bug-nya hidup: `pg` mengembalikan `timestamptz` sebagai `Date` bermilidetik,
     * jadi cursor berbasis `getTime()` membulatkan ketiganya ke batas yang sama. Perbandingan
     * `(completed_at, id) < (cursor)` lalu menolak dua sisanya — keduanya sub-milidetik lebih
     * AWAL dari batas, tapi setelah dibulatkan terbaca lebih baru — dan riwayatnya hilang
     * tanpa ada yang bisa melihatnya.
     */
    for (let index = 0; index < 29; index += 1) {
      await completeAt(userId, `2026-03-01T11:00:${String(index).padStart(2, '0')}.000000Z`)
    }
    await completeAt(userId, '2026-03-01T10:00:00.500900Z')
    await completeAt(userId, '2026-03-01T10:00:00.500400Z')
    await completeAt(userId, '2026-03-01T10:00:00.500100Z')

    const seen: string[] = []
    let cursor = null as ReturnType<typeof parseHistoryCursor>
    for (let page = 0; page < 6; page += 1) {
      const result = await getHistoryPage(userId, cursor)
      for (const entry of result.entries) seen.push(entry.id)
      if (result.nextCursor === null) break
      cursor = parseHistoryCursor(result.nextCursor)
      expect(cursor).not.toBeNull()
    }

    expect(seen).toHaveLength(32)
    expect(new Set(seen).size).toBe(32)
  })

  it('menolak cursor yang bentuknya tidak dikenal', async () => {
    const { parseHistoryCursor } = await import('./history')

    expect(parseHistoryCursor(null)).toBeNull()
    expect(parseHistoryCursor('')).toBeNull()
    expect(parseHistoryCursor('12')).toBeNull()
    expect(parseHistoryCursor('12:kemarin')).toBeNull()
    expect(parseHistoryCursor(':2026-03-01T10:00:00.500900Z')).toBeNull()
    expect(parseHistoryCursor('abc:2026-03-01T10:00:00.500900Z')).toBeNull()
    expect(parseHistoryCursor('12:2026-03-01T10:00:00.500900Z')).toEqual({
      id: '12',
      completedAt: '2026-03-01T10:00:00.500900Z',
    })
  })
})
