import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

async function makeUser(name: string): Promise<{ id: number; publicId: string }> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string; public_id: string }>(
    `insert into users(telegram_id,first_name,referral_code) values($1,$2,$3)
     returning id, public_id`,
    [700_000_000_000_000 + suffix, name, generateReferralCode()],
  )
  return { id: Number(rows[0].id), publicId: rows[0].public_id }
}

async function completeTask(userId: number, reward: number) {
  const { query } = await import('../platform/db')
  const rows = await query<{ id: string }>(
    `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,submitted_at,solved)
     values($1,'text','Easy','{}'::jsonb,'\\x00'::bytea,$2,now(),now(),true) returning id`,
    [userId, reward],
  )
  await query(
    `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
     values($1,$2,'text','Easy',1000,3,$3,now())`,
    [userId, rows[0].id, reward],
  )
}

/** Potret papan dipakai bersama seluruh pemirsa selama 60 detik. Yang tidak boleh ikut dipakai bersama adalah baris "kamu": satu kekeliruan di sana membuat seorang user melihat posisi, saldo, dan nama orang lain sebagai miliknya. */
describe('LB-1 — potret bersama, baris "kamu" tetap milik masing-masing', () => {
  it('memberi tiap pemirsa barisnya sendiri dari potret yang sama', async () => {
    const { getLeaderboard } = await import('./leaderboard')
    const satu = await makeUser('Satu')
    const dua = await makeUser('Dua')
    await completeTask(satu.id, 9)
    await completeTask(dua.id, 4)

    const papanSatu = await getLeaderboard(satu.id)
    const papanDua = await getLeaderboard(dua.id)

    expect(papanSatu.you?.id).toBe(satu.publicId)
    expect(papanDua.you?.id).toBe(dua.publicId)
    expect(papanSatu.you?.credits).toBe(9)
    expect(papanDua.you?.credits).toBe(4)
  })

  it('menandai tepat satu baris papan sebagai milik pemirsanya', async () => {
    const { getLeaderboard } = await import('./leaderboard')
    const satu = await makeUser('Tiga')
    const dua = await makeUser('Empat')
    await completeTask(satu.id, 7)
    await completeTask(dua.id, 6)

    const papanSatu = await getLeaderboard(satu.id)
    const papanDua = await getLeaderboard(dua.id)

    const milik = (papan: Awaited<ReturnType<typeof getLeaderboard>>) =>
      papan.entries.filter((entry) => entry.you).map((entry) => entry.id)

    expect(milik(papanSatu)).toEqual([satu.publicId])
    expect(milik(papanDua)).toEqual([dua.publicId])
  })

  it('menyajikan jumlah peserta yang sama untuk semua pemirsa', async () => {
    const { getLeaderboard } = await import('./leaderboard')
    const satu = await makeUser('Lima')
    const dua = await makeUser('Enam')
    await completeTask(satu.id, 3)
    await completeTask(dua.id, 2)

    const papanSatu = await getLeaderboard(satu.id)
    const papanDua = await getLeaderboard(dua.id)

    expect(papanDua.participants).toBe(papanSatu.participants)
    expect(papanDua.premiumMembers).toBe(papanSatu.premiumMembers)
  })
})
