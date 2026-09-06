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

/** Menaruh satu penyelesaian pada titik waktu tertentu. Semua pemanggilnya memakai waktu yang
 * dihitung RELATIF terhadap batas musim, bukan relatif `now()` — lihat `seasonStart`. */
async function completeTaskAtTime(userId: number, reward: number, at: Date) {
  const { query } = await import('../platform/db')
  const rows = await query<{ id: string }>(
    `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,submitted_at,solved)
     values($1,'text','Easy','{}'::jsonb,'\\x00'::bytea,$2,now(),now(),true) returning id`,
    [userId, reward],
  )
  await query(
    `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
     values($1,$2,'text','Easy',1000,3,$3,$4)`,
    [userId, rows[0].id, reward, at],
  )
}

/** Awal musim berjalan MENURUT kueri papan itu sendiri, dibaca lewat API publiknya.
 *
 * Ini yang membuat berkas ini berhenti bergantung pada tanggal. Bentuk lamanya menaruh penyelesaian
 * di `now()` dan menganggapnya pasti masuk musim berjalan — anggapan yang benar di Postgres asli,
 * tapi tidak di PGlite yang dipakai uji: `at time zone 'Asia/Jakarta'` di sana membalik arah
 * konversinya (menjawab +7 jam, bukan −7), jadi selama ±13 jam setelah musim berganti batasnya
 * jatuh di MASA DEPAN dan seluruh penyelesaian tersaring keluar. Papan jadi kosong, `you` jadi
 * null, dan tiga uji di berkas ini gagal — tapi hanya kalau CI kebetulan jalan di jendela itu,
 * yaitu sekitar 8% waktu. Persis itu yang terjadi pada run yang menggagalkan CI di commit
 * sebelumnya.
 *
 * Yang diuji sekarang ATURAN jendelanya — yang jatuh sesudah batas dihitung, yang jatuh sebelumnya
 * tidak — bukan di mana batas itu mendarat pada jam dinding hari ini. Aturan itu yang jadi milik
 * papan; letak batasnya milik aritmetika tanggal, dan menegakkannya lewat `now()` cuma membuat uji
 * ini melaporkan kekurangan PGlite sebagai kerusakan kode produksi. */
async function seasonStart(): Promise<Date> {
  const { getLeaderboard } = await import('./leaderboard')
  const board = await getLeaderboard(0)
  if (board.seasonStartedAt === null) throw new Error('musim sedang mati, batasnya tidak ada')
  return new Date(board.seasonStartedAt)
}

/** Satu menit setelah musim dimulai: sedekat mungkin dengan batasnya, dan pasti di dalamnya. */
async function completeTask(userId: number, reward: number) {
  const start = await seasonStart()
  await completeTaskAtTime(userId, reward, new Date(start.getTime() + 60_000))
}

/** Satu hari sebelum musim dimulai: pasti di luar jendela, berapa pun panjang musimnya. */
async function completeTaskBeforeSeason(userId: number, reward: number) {
  const start = await seasonStart()
  await completeTaskAtTime(userId, reward, new Date(start.getTime() - 86_400_000))
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

/** Musim mingguan ada supaya user baru punya peluang: papan sepanjang masa membuat peringkat
 * dikuasai akun paling lama, dan itu berhenti jadi alasan bersaing untuk semua orang lain. */
describe('LB-SEASON — papan hanya menghitung musim berjalan', () => {
  it('membuang task dari musim sebelumnya, dan menyebutkan batas musimnya', async () => {
    const { setActiveEconomyConfig, economyConfig } = await import('@/domain/economy/economy-config')
    const { getLeaderboard } = await import('./leaderboard')
    const sebelumnya = economyConfig()

    try {
      setActiveEconomyConfig({ ...sebelumnya, leaderboardSeasonDays: 7 })
      /** Dua user, bukan satu yang diukur dua kali: potret papan menghafal baris "kamu" selama 60
       * detik, jadi mengukur user yang sama sebelum dan sesudah menambah task menguji cache-nya,
       * bukan jendela musimnya. */
      const lama = await makeUser('Musim lalu')
      const kini = await makeUser('Musim ini')
      await completeTaskBeforeSeason(lama.id, 500)
      await completeTask(kini.id, 7)

      const board = await getLeaderboard(kini.id)
      expect(board.seasonStartedAt).not.toBeNull()
      expect(board.seasonEndsAt).not.toBeNull()
      expect(board.you?.credits).toBe(7)
      /** 500 credit dari 30 hari lalu ada di musim lain, jadi pemiliknya tidak muncul sama sekali
       * — bukan muncul dengan nol. */
      expect(board.entries.some((entry) => entry.id === lama.publicId)).toBe(false)
    } finally {
      setActiveEconomyConfig(sebelumnya)
    }
  })

  it('kembali menghitung sepanjang masa saat musimnya disetel nol', async () => {
    const { setActiveEconomyConfig, economyConfig } = await import('@/domain/economy/economy-config')
    const { getLeaderboard } = await import('./leaderboard')
    const sebelumnya = economyConfig()

    try {
      setActiveEconomyConfig({ ...sebelumnya, leaderboardSeasonDays: 0 })
      const user = await makeUser('Sepanjang masa')
      /** Musimnya mati, jadi tidak ada batas untuk dijadikan acuan — dan memang tidak perlu:
       * yang diuji justru bahwa penyelesaian setua apa pun tetap dihitung. */
      await completeTaskAtTime(user.id, 500, new Date(Date.now() - 30 * 86_400_000))

      const board = await getLeaderboard(user.id)
      expect(board.seasonStartedAt).toBeNull()
      expect(board.seasonEndsAt).toBeNull()
      /** Tanpa musim, task 30 hari lalu tetap dihitung — itu perilaku papan sepanjang masa. */
      expect(board.you?.credits).toBe(500)
    } finally {
      setActiveEconomyConfig(sebelumnya)
    }
  })
})
