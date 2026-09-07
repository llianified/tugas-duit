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
 * Ini yang membuat pemanggilnya berhenti bergantung pada tanggal. Bentuk lamanya menaruh
 * penyelesaian di `now()` dan menganggapnya pasti masuk musim berjalan — anggapan yang runtuh
 * selama 14 jam pertama tiap musim, ketika batasnya jatuh di MASA DEPAN dan seluruh penyelesaian
 * tersaring keluar. Papan jadi kosong, `you` jadi null, dan tiga uji di berkas ini gagal, tapi
 * hanya kalau CI kebetulan jalan di jendela itu — sekitar 8% waktu.
 *
 * Catatan di sini dulu menyalahkan PGlite: konon `at time zone 'Asia/Jakarta'` di sana membalik
 * arah konversinya, sementara Postgres asli benar. Itu KELIRU, dan kekeliruannya mahal — ia
 * membuat satu-satunya gejala yang pernah muncul dibaca sebagai kekurangan alat uji, lalu ujinya
 * ditulis ulang supaya berhenti melihatnya. Bug-nya bertahan di produksi sampai papan Neon
 * ketahuan kosong dengan 131.763 penyelesaian di tabelnya. Penyebab sebenarnya bukan mesinnya
 * melainkan resolusi tipe Postgres yang berlaku di keduanya — lihat `seasonBoundsSql`.
 *
 * Yang diuji lewat helper ini tetap ATURAN jendelanya: yang jatuh sesudah batas dihitung, yang
 * sebelumnya tidak. Letak batasnya diuji terpisah dan langsung, karena justru itu yang dulu tidak
 * dijaga siapa pun. */
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

  /** Batas musim harus mendarat TEPAT di tengah malam WIB. Uji lain di berkas ini sengaja tidak
   * memeriksanya — semuanya menghitung waktu relatif terhadap batas yang dijawab kueri itu
   * sendiri, jadi batas yang meleset pun tetap konsisten dengan dirinya dan lolos. Justru di
   * celah itu bug-nya hidup: `date at time zone` memanggil `timezone(text, timestamptz)` karena
   * `timestamptz` tipe preferred, sehingga tanggalnya dibaca sebagai tengah malam UTC dan batasnya
   * mendarat pukul 07:00 sebagai timestamp polos — 14 jam terlambat. Papan lalu kosong total dari
   * 00:00 sampai 14:00 WIB tiap hari pergantian musim, ~8% waktu, dan itu terjadi di produksi.
   *
   * Yang dipaku di sini letak batasnya, bukan aturan jendelanya, karena letak itulah yang tidak
   * dijaga siapa pun. */
  it('menaruh batas musim tepat di tengah malam WIB, tidak pernah di masa depan', async () => {
    const { setActiveEconomyConfig, economyConfig } = await import('@/domain/economy/economy-config')
    const { getLeaderboard } = await import('./leaderboard')
    const sebelumnya = economyConfig()
    const days = 7

    try {
      setActiveEconomyConfig({ ...sebelumnya, leaderboardSeasonDays: days })
      const user = await makeUser('Batas musim')
      const board = await getLeaderboard(user.id)

      const startedAt = board.seasonStartedAt
      const endsAt = board.seasonEndsAt
      if (startedAt === null || endsAt === null) throw new Error('musim mati, batasnya tidak ada')

      /** Gejala paling langsung dari batas yang meleset: musim yang "sedang berjalan" ternyata
       * belum dimulai, dan tiap penyelesaian tersaring keluar karena jatuh sebelum batasnya. */
      expect(startedAt).toBeLessThanOrEqual(Date.now())
      expect(endsAt).toBeGreaterThan(Date.now())

      /** Jam dinding Jakarta di titik itu harus 00:00:00 pas. `h23` dipakai, bukan `hour12:false`,
       * karena yang terakhir mencetak tengah malam sebagai "24" di sebagian ICU. */
      const jam = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(startedAt))
      expect(jam).toBe('00:00:00')
      expect(new Date(startedAt).getUTCMilliseconds()).toBe(0)

      /** Panjang musimnya persis sepanjang yang disetel — dan karena itu sisa waktunya tidak
       * pernah melebihi panjang itu. Countdown 172 jam pada musim 7 hari adalah bentuk lain dari
       * batas yang sama melesetnya. */
      expect(endsAt - startedAt).toBe(days * 86_400_000)
      expect(endsAt - Date.now()).toBeLessThanOrEqual(days * 86_400_000)
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
