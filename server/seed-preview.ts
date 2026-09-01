import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { commissionUnitsForReward, splitUnitsIntoCredits } from '@/features/referral/domain'
import { missionDefinition } from '@/domain/missions'
import { creditsToRupiah } from '@/domain/economy'
import { transaction } from './db'
import { generateReferralCode } from './referral'
import { appendLedger } from './ledger'

/**
 * Isi data untuk preview yang dilihat manusia — bukan fixture uji.
 *
 * Bedanya dengan `payout-fixtures.ts`: di sana yang dikejar adalah lolos gerbang dengan
 * data seminimal mungkin, di sini yang dikejar adalah setiap layar punya isi yang masuk
 * akal dibaca — riwayat yang tersebar di beberapa hari, papan peringkat yang punya
 * pesaing, referral yang komisinya benar-benar terhitung, penarikan yang pernah dibayar
 * dan pernah ditolak.
 *
 * Dijalankan dari `app/api/dev/seed/route.ts`, di dalam proses server dev — bukan skrip
 * CLI. PGlite memegang `dataDir` per proses, jadi proses kedua yang membuka direktori
 * yang sama saat `pnpm dev` hidup akan bertabrakan di lock filenya.
 */

const PREVIEW_TELEGRAM_ID = 900_000_000_000_001

/**
 * Semua user buatan seed lahir di atas ambang ini, dan itulah yang membuat reset bisa
 * ditulis sebagai satu `delete` alih-alih mencatat id yang pernah dibuat: apa pun di atas
 * ambang ini adalah data preview, kecuali user preview itu sendiri. Ambangnya juga sudah
 * dipakai `payout-fixtures.ts` (700_100_…), jadi sisa fixture dari `pnpm test` yang
 * pernah menumpang direktori data yang sama ikut tersapu.
 */
const SEED_USER_FLOOR = 700_000_000_000_000
const RIVAL_BASE = 710_000_000_000_000
const DOWNLINE_BASE = 720_000_000_000_000

/** Saldo yang tersisa setelah semua penarikan diperhitungkan. */
const TARGET_BALANCE = 4_820

const TIME_ZONE = 'Asia/Jakarta'
/** Offset WIB tetap sepanjang tahun — Indonesia tidak memakai DST. */
const WIB_SUFFIX = '+07:00'

type Difficulty = 'Easy' | 'Medium' | 'Hard'
type CaptchaType = 'text' | 'math' | 'select'

const REWARD_TABLE: Record<Difficulty, [number, number, number]> = {
  Easy: [1, 2, 3],
  Medium: [2, 3, 5],
  Hard: [3, 6, 9],
}
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard']
const TYPES: CaptchaType[] = ['text', 'math', 'select']

/**
 * PRNG bibit tetap, bukan `Math.random`: angka yang sama pada setiap seed berarti
 * tangkapan layar dan laporan bug dari preview bisa dibandingkan antar-jalan. Reset lalu
 * seed ulang harus menghasilkan layar yang sama, bukan sekadar layar yang terisi.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)]
}

const WIB_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Tanggal WIB, `daysAgo` hari ke belakang, sebagai `YYYY-MM-DD`.
 *
 * Batas harinya harus sama persis dengan yang dipakai server —
 * `(completed_at at time zone 'Asia/Jakarta')::date` di `payout.ts`, `missions.ts`, dan
 * `stats.ts`. Menghitungnya dari waktu UTC lokal proses akan menggeser satu hari setiap
 * kali seed dijalankan antara 17:00 dan 24:00 UTC, dan pergeseran itu tepat mengenai dua
 * hal yang paling dipakai: jumlah hari aktif untuk gerbang penarikan, dan kemajuan misi
 * hari ini.
 */
function wibDate(daysAgo: number): string {
  const today = WIB_DATE_FORMAT.format(new Date())
  const [year, month, day] = today.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day) - daysAgo * 86_400_000)
  return shifted.toISOString().slice(0, 10)
}

/** Timestamp WIB pada hari lampau — jam kerja wajar, bukan tengah malam semua. */
function pastTimestamp(daysAgo: number, random: () => number): string {
  const hour = 8 + Math.floor(random() * 13)
  const minute = Math.floor(random() * 60)
  const second = Math.floor(random() * 60)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${wibDate(daysAgo)}T${pad(hour)}:${pad(minute)}:${pad(second)}${WIB_SUFFIX}`
}

/**
 * Timestamp yang dijamin jatuh **hari ini menurut WIB** dan tetap di masa lalu.
 *
 * Keduanya sekaligus, karena keduanya bisa saling menabrak: jam kerja acak (mis. 19:00)
 * akan berada di masa depan kalau seed dijalankan pagi WIB — dan task selesai di masa
 * depan membuat kemajuan misi terlihat benar sementara riwayatnya berisi hari esok.
 * Sebaliknya, sekadar mengurangi menit dari sekarang akan melewati tengah malam WIB saat
 * seed dijalankan lewat dini hari, dan task itu berhenti dihitung misi hari ini.
 */
function todayTimestamp(index: number, spacingMinutes = 6): string {
  const now = Date.now()
  const midnight = new Date(`${wibDate(0)}T00:00:00${WIB_SUFFIX}`).getTime()
  const spaced = now - (index + 1) * spacingMinutes * 60_000
  const value = Math.min(now - 1_000, Math.max(midnight + index * 1_000, spaced))
  return new Date(value).toISOString()
}

const RIVAL_NAMES = [
  'Rizky',
  'Siti',
  'Bagas',
  'Dewi',
  'Fajar',
  'Intan',
  'Yoga',
  'Nadia',
  'Arif',
  'Putri',
  'Hendra',
  'Lestari',
  'Gilang',
  'Maya',
  'Reza',
  'Ayu',
]

const DOWNLINE_NAMES = ['Andi', 'Bunga', 'Chandra', 'Dimas', 'Eka', 'Farid', 'Gita', 'Hafiz']

interface CompletionInput {
  userId: number
  type: CaptchaType
  difficulty: Difficulty
  stars: 1 | 2 | 3
  reward: number
  elapsedMs: number
  completedAt: string
}

/**
 * Satu task selesai selalu berarti dua baris: `challenges` yang sudah disubmit dan
 * `task_completions` yang menunjuknya. Menulis salah satunya saja membuat halaman riwayat
 * dan statistik bercerita beda, dan `task_completions.challenge_id` memang `not null
 * unique` supaya bentuk itu mustahil.
 */
async function insertCompletion(tx: PoolClient, input: CompletionInput): Promise<string> {
  const challenge = await tx.query<{ id: string }>(
    `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,
                            issued_at,expires_at,submitted_at,attempts,solved,energy_spent_at)
     values($1,$2,$3,'{}','\\x00',$4,
            $5::timestamptz - interval '20 seconds',
            $5::timestamptz + interval '5 minutes',
            $5::timestamptz, 1, true, $5::timestamptz - interval '20 seconds')
     returning id`,
    [
      input.userId,
      input.type,
      input.difficulty,
      REWARD_TABLE[input.difficulty][2],
      input.completedAt,
    ],
  )
  const completion = await tx.query<{ id: string }>(
    `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
     values($1,$2,$3,$4,$5,$6,$7,$8::timestamptz) returning id`,
    [
      input.userId,
      challenge.rows[0].id,
      input.type,
      input.difficulty,
      input.elapsedMs,
      input.stars,
      input.reward,
      input.completedAt,
    ],
  )
  return completion.rows[0].id
}

async function resetPreviewData(tx: PoolClient, userId: number): Promise<void> {
  /**
   * User buatan seed dihapus lebih dulu, dan penghapusannya menyeret komisi, task, dan
   * challenge mereka lewat `on delete cascade`. Yang punya baris `credit_ledger` atau
   * `withdrawals` dikecualikan: keduanya `on delete restrict`, jadi menyertakannya bukan
   * "reset yang lebih bersih" melainkan `delete` yang gagal dan menggagalkan seluruh
   * transaksi seed.
   */
  await tx.query(
    `delete from users u
      where u.telegram_id >= $1 and u.telegram_id <> $2
        and not exists (select 1 from credit_ledger l where l.user_id = u.id)
        and not exists (select 1 from withdrawals w where w.user_id = u.id)`,
    [SEED_USER_FLOOR, PREVIEW_TELEGRAM_ID],
  )

  /**
   * Urutannya bukan selera: `task_completions.challenge_id` adalah `on delete restrict`,
   * jadi task harus pergi sebelum challenge-nya; `challenges.ad_view_id` menunjuk
   * `ad_views`, jadi challenge harus pergi sebelum tayangan iklannya.
   *
   * `credit_ledger` tidak ikut dan tidak bisa ikut — trigger `credit_ledger_append_only`
   * menolak `delete` dan `truncate`. Saldonya karena itu tidak direset dengan menghapus
   * riwayatnya, melainkan didorong ke angka target lewat satu `adjustment` di akhir.
   */
  await tx.query('delete from referral_commissions where upline_id = $1', [userId])
  await tx.query('delete from withdrawals where user_id = $1', [userId])
  await tx.query('delete from task_completions where user_id = $1', [userId])
  await tx.query('delete from challenges where user_id = $1', [userId])
  await tx.query('delete from ad_views where user_id = $1', [userId])
  await tx.query('delete from mission_claims where user_id = $1', [userId])
  await tx.query('delete from daily_quotas where user_id = $1', [userId])
  await tx.query('delete from fraud_signals where user_id = $1', [userId])
  await tx.query('delete from referral_wallets where user_id = $1', [userId])
}

/**
 * Baca dulu, sisipkan kalau belum ada — bukan `insert … on conflict do update returning`.
 *
 * Bentuk upsert itu yang dipakai `/api/dev/login`, dan di PGlite ia mengembalikan nol baris
 * ketika yang terjadi adalah cabang `do update`-nya: `returning` pada konflik tidak
 * menghasilkan apa pun, jadi `rows[0]` undefined tepat pada seed kedua dan seterusnya —
 * yaitu justru jalur yang paling sering dilewati.
 */
async function ensurePreviewUser(tx: PoolClient): Promise<number> {
  const found = await tx.query<{ id: string }>('select id from users where telegram_id = $1', [
    PREVIEW_TELEGRAM_ID,
  ])
  if (found.rows[0]) {
    await tx.query('update users set updated_at = now() where id = $1', [found.rows[0].id])
    return Number(found.rows[0].id)
  }
  const created = await tx.query<{ id: string }>(
    `insert into users(telegram_id,username,first_name,referral_code)
     values($1,'preview_dev','Preview',$2) returning id`,
    [PREVIEW_TELEGRAM_ID, generateReferralCode()],
  )
  return Number(created.rows[0].id)
}

/** Riwayat task user preview, tersebar 14 hari WIB ke belakang termasuk hari ini. */
async function seedOwnTasks(tx: PoolClient, userId: number): Promise<number> {
  const random = makeRandom(20_260_901)
  const missionTasks = missionDefinition('tasks').target
  const missionStars = missionDefinition('stars').target
  let credits = 0
  let count = 0

  for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
    /**
     * Hari ini sengaja dibuat sudah melewati target misi task dan misi bintang tiga:
     * kartu misi yang selalu kosong di preview tidak bisa dipakai memeriksa apa pun,
     * termasuk tombol klaimnya. Targetnya dibaca dari `domain/missions`, bukan diketik
     * ulang, supaya seed tidak basi saat targetnya disetel di panel admin.
     */
    const today = daysAgo === 0
    const perDay = today ? missionTasks + 2 : 1 + Math.floor(random() * 5)
    const threeStars = today ? missionStars + 1 : Math.floor(random() * 2)

    for (let n = 0; n < perDay; n += 1) {
      const difficulty = pick(random, DIFFICULTIES)
      const stars: 1 | 2 | 3 = n < threeStars ? 3 : ((1 + Math.floor(random() * 2)) as 1 | 2)
      const reward = REWARD_TABLE[difficulty][stars - 1]
      const completionId = await insertCompletion(tx, {
        userId,
        type: pick(random, TYPES),
        difficulty,
        stars,
        reward,
        elapsedMs: 3_000 + Math.floor(random() * 20_000),
        completedAt: today ? todayTimestamp(n) : pastTimestamp(daysAgo, random),
      })
      /**
       * Kunci idempotensinya turunan id barisnya, bukan penghitung urutan: `credit_ledger`
       * tidak bisa dihapus saat reset, jadi kunci macam `seed:task:7` akan cocok dengan
       * baris seed sebelumnya dan `appendLedger` mengembalikannya tanpa menambah saldo —
       * statistik "credit dari task" lalu berhenti tumbuh sementara riwayat task-nya baru.
       */
      await appendLedger(tx, {
        userId,
        kind: 'task',
        amount: reward,
        idempotencyKey: `seed:task:${completionId}`,
        referenceId: completionId,
        note: 'Task preview',
      })
      credits += reward
      count += 1
    }
  }

  await tx.query(
    `insert into daily_quotas(user_id,quota_date,tasks_completed,credits_earned)
     select $1, (completed_at at time zone 'Asia/Jakarta')::date,
            count(*)::int, coalesce(sum(reward),0)::int
       from task_completions where user_id = $1
      group by 2
     on conflict(user_id,quota_date) do update
        set tasks_completed = excluded.tasks_completed,
            credits_earned = excluded.credits_earned`,
    [userId],
  )

  console.log(`[seed] ${count} task preview, ${credits} credit`)
  return credits
}

/** Tayangan iklan hari ini supaya misi "tonton iklan" punya kemajuan yang nyata. */
async function seedAdViews(tx: PoolClient, userId: number): Promise<void> {
  const target = missionDefinition('ads').target
  /**
   * State `consumed`, bukan `ready`: `ad_views_one_ready` unik per user, jadi lebih dari
   * satu baris `ready` akan gagal — dan tiket yang menganggur di state `ready` juga akan
   * dianggap pass iklan yang belum dipakai oleh `server/ads.ts`.
   */
  for (let n = 0; n < target; n += 1) {
    const at = todayTimestamp(n, 11)
    await tx.query(
      `insert into ad_views(user_id,block_id,state,created_at,expires_at,ready_at,consumed_at)
       values($1,$2,'consumed',$3::timestamptz,
              $3::timestamptz + interval '5 minutes',
              $3::timestamptz + interval '35 seconds',
              $3::timestamptz + interval '40 seconds')`,
      [userId, `preview-block-${n + 1}`, at],
    )
  }
}

/**
 * Satu misi sengaja ditinggalkan sudah diklaim dan sisanya siap diklaim: preview perlu
 * menunjukkan kedua bentuk kartunya, bukan hanya satu.
 */
async function seedMissionClaims(tx: PoolClient, userId: number): Promise<void> {
  await tx.query(
    `insert into mission_claims(user_id,quota_date,mission_key,energy_granted)
     values($1,(now() at time zone 'Asia/Jakarta')::date,'tasks',$2)
     on conflict(user_id,quota_date,mission_key) do nothing`,
    [userId, missionDefinition('tasks').reward],
  )
}

/** Downline dengan task dan komisi yang benar-benar terhitung, bukan nama kosong. */
async function seedReferrals(tx: PoolClient, uplineId: number): Promise<number> {
  const random = makeRandom(777_001)
  let units = 0

  for (const [index, name] of DOWNLINE_NAMES.entries()) {
    const joinedDaysAgo = 20 - index * 2
    const downline = await tx.query<{ id: string }>(
      `insert into users(telegram_id,first_name,username,referral_code,referred_by,created_at)
       values($1,$2,$3,$4,$5, now() - ($6::int * interval '1 day'))
       returning id`,
      [
        DOWNLINE_BASE + index,
        name,
        `preview_ref_${index + 1}`,
        generateReferralCode(),
        uplineId,
        joinedDaysAgo,
      ],
    )
    const downlineId = Number(downline.rows[0].id)
    const taskCount = 3 + Math.floor(random() * 7)

    for (let n = 0; n < taskCount; n += 1) {
      const difficulty = pick(random, DIFFICULTIES)
      const stars: 1 | 2 | 3 = (1 + Math.floor(random() * 3)) as 1 | 2 | 3
      const reward = REWARD_TABLE[difficulty][stars - 1]
      const daysAgo = Math.max(0, joinedDaysAgo - 1 - n)
      const completionId = await insertCompletion(tx, {
        userId: downlineId,
        type: pick(random, TYPES),
        difficulty,
        stars,
        reward,
        elapsedMs: 4_000 + Math.floor(random() * 18_000),
        completedAt: daysAgo === 0 ? todayTimestamp(n, 9) : pastTimestamp(daysAgo, random),
      })
      const commissionUnits = commissionUnitsForReward(reward)
      if (commissionUnits <= 0) continue
      await tx.query(
        `insert into referral_commissions(upline_id,downline_id,task_completion_id,reward,commission_units)
         values($1,$2,$3,$4,$5)`,
        [uplineId, downlineId, completionId, reward, commissionUnits],
      )
      units += commissionUnits
    }
  }

  /**
   * Unit dipecah sekali di akhir, sama seperti `accrueCommission`: yang di bawah 100 unit
   * menginap di `referral_wallets.pending_units` (kolomnya memang dibatasi 0–99), sisanya
   * jadi credit di ledger. Membayar setiap komisi sebagai credit utuh akan membuat halaman
   * referral menampilkan pembulatan yang tidak pernah terjadi di produksi.
   */
  const { credits, remainderUnits } = splitUnitsIntoCredits(units)
  await tx.query(
    `insert into referral_wallets(user_id,pending_units) values($1,$2)
     on conflict(user_id) do update set pending_units = excluded.pending_units, updated_at = now()`,
    [uplineId, remainderUnits],
  )
  if (credits > 0) {
    await appendLedger(tx, {
      userId: uplineId,
      kind: 'commission',
      amount: credits,
      idempotencyKey: `seed:commission:${randomUUID()}`,
      note: `Komisi referral preview (${units} unit)`,
    })
  }
  console.log(`[seed] ${DOWNLINE_NAMES.length} downline, ${units} unit komisi`)
  return credits
}

/** Pesaing papan peringkat: peringkat tanpa peserta lain tidak menunjukkan apa pun. */
async function seedRivals(tx: PoolClient): Promise<void> {
  const random = makeRandom(31_337)

  for (const [index, name] of RIVAL_NAMES.entries()) {
    const premium = index % 5 === 0
    /**
     * `balance_credits` dibiarkan nol, bukan diisi angka enak dilihat: saldo di `users`
     * harus selalu sama dengan jumlah `credit_ledger` user itu, dan pesaing papan
     * peringkat tidak punya baris ledger. Angka yang dipakai papan peringkat adalah
     * `sum(task_completions.reward)`, bukan saldo, jadi tidak ada yang hilang.
     */
    const rival = await tx.query<{ id: string }>(
      `insert into users(telegram_id,first_name,username,referral_code,created_at,premium_until)
       values($1,$2,$3,$4, now() - ($5::int * interval '1 day'), $6)
       returning id`,
      [
        RIVAL_BASE + index,
        name,
        `preview_top_${index + 1}`,
        generateReferralCode(),
        30 - index,
        premium ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
      ],
    )
    const rivalId = Number(rival.rows[0].id)
    /**
     * Papan peringkat mengurutkan `sum(task_completions.reward)`, jadi jumlah task turun
     * seiring indeks — user preview harus punya tetangga di atas dan di bawahnya, bukan
     * mendarat di dasar atau di puncak papan.
     */
    const taskCount = 34 - index * 2

    for (let n = 0; n < taskCount; n += 1) {
      const difficulty = pick(random, DIFFICULTIES)
      const stars: 1 | 2 | 3 = (1 + Math.floor(random() * 3)) as 1 | 2 | 3
      const daysAgo = 1 + Math.floor(random() * 13)
      await insertCompletion(tx, {
        userId: rivalId,
        type: pick(random, TYPES),
        difficulty,
        stars,
        reward: REWARD_TABLE[difficulty][stars - 1],
        elapsedMs: 3_000 + Math.floor(random() * 20_000),
        completedAt: pastTimestamp(daysAgo, random),
      })
    }
  }
  console.log(`[seed] ${RIVAL_NAMES.length} pesaing papan peringkat`)
}

interface PayoutSeed {
  credits: number
  channel: 'dana' | 'gopay' | 'ovo'
  account: string
  daysAgo: number
  state: 'paid' | 'rejected'
}

/**
 * Riwayat penarikan yang seluruhnya sudah final — tidak ada satu pun `processing`.
 *
 * Itu bukan kelalaian: `withdrawals_one_active_per_user` melarang pengajuan kedua selama
 * masih ada yang `processing`, jadi menyisakan satu baris pending berarti form penarikan
 * di preview selalu menolak sebelum sampai ke validasinya. Riwayatnya tetap punya dua
 * bentuk yang berbeda (dibayar dengan bukti, dan ditolak dengan alasan), dan semuanya
 * lebih tua dari cooldown supaya gerbang waktunya juga lolos.
 */
const PAYOUTS: PayoutSeed[] = [
  { credits: 150, channel: 'dana', account: '081234567890', daysAgo: 41, state: 'paid' },
  { credits: 120, channel: 'gopay', account: '081234567890', daysAgo: 27, state: 'rejected' },
  { credits: 300, channel: 'dana', account: '081234567890', daysAgo: 15, state: 'paid' },
]

async function seedPayouts(tx: PoolClient, userId: number): Promise<void> {
  for (const payout of PAYOUTS) {
    const hold = await appendLedger(tx, {
      userId,
      kind: 'withdrawal_hold',
      amount: -payout.credits,
      idempotencyKey: `seed:hold:${randomUUID()}`,
      note: 'Penahanan penarikan preview',
    })
    const inserted = await tx.query<{ id: string }>(
      `insert into withdrawals(user_id,channel_id,account_number,account_name,credits,amount_idr,
                               state,hold_ledger_id,requested_at,paid_at,rejected_at,reject_reason,
                               proof_file_id,proof_sent_at)
       values($1,$2,$3,'Preview Pengguna',$4,$5,$6,$7,
              now() - ($8::int * interval '1 day'),
              case when $6 = 'paid' then now() - ($8::int * interval '1 day') + interval '4 hours' end,
              case when $6 = 'rejected' then now() - ($8::int * interval '1 day') + interval '6 hours' end,
              case when $6 = 'rejected' then 'Nama akun tidak cocok dengan nomor tujuan.' end,
              case when $6 = 'paid' then $9 end,
              case when $6 = 'paid' then now() - ($8::int * interval '1 day') + interval '4 hours' end)
       returning id`,
      [
        userId,
        payout.channel,
        payout.account,
        payout.credits,
        creditsToRupiah(payout.credits),
        payout.state,
        hold.ledgerId,
        payout.daysAgo,
        `preview-proof-${payout.daysAgo}`,
      ],
    )
    if (payout.state === 'rejected') {
      /**
       * Penolakan harus mengembalikan yang ditahan. Tanpa baris refund-nya, saldo di
       * `users` dan jumlah ledger berselisih tepat sebesar nominalnya — dan itu bentuk
       * kerusakan yang paling sulit dikenali dari layar, karena angka saldonya tetap
       * terlihat wajar.
       */
      await appendLedger(tx, {
        userId,
        kind: 'withdrawal_refund',
        amount: payout.credits,
        idempotencyKey: `seed:refund:${randomUUID()}`,
        referenceId: inserted.rows[0].id,
        note: 'Pengembalian penarikan yang ditolak',
      })
    }
  }
  console.log(`[seed] ${PAYOUTS.length} riwayat penarikan`)
}

/**
 * Saldo tidak dijumlahkan dari langkah-langkah di atas, melainkan didorong ke angka target
 * lewat satu `adjustment`.
 *
 * Alasannya `credit_ledger` append-only: reset tidak bisa menghapus baris ledger lama,
 * jadi seed yang kedua berangkat dari saldo yang sudah bukan nol. Menghitung selisihnya
 * membuat hasilnya sama pada seed pertama dan seed kesepuluh, dan menjaga saldo di `users`
 * tetap sama dengan jumlah ledgernya — invarian yang seluruh pemeriksaan uang di repo ini
 * bersandar padanya.
 */
async function settleBalance(tx: PoolClient, userId: number, target: number): Promise<number> {
  const rows = await tx.query<{ balance_credits: string }>(
    'select balance_credits from users where id = $1',
    [userId],
  )
  const delta = target - Number(rows[0].balance_credits)
  if (delta === 0) return target
  await appendLedger(tx, {
    userId,
    kind: 'adjustment',
    amount: delta,
    idempotencyKey: `seed:balance:${randomUUID()}`,
    note: 'Penyetelan saldo data preview',
  })
  return target
}

export interface SeedPreviewResult {
  userId: number
  balance: number
  taskCredits: number
  commissionCredits: number
  payouts: number
  downlines: number
  rivals: number
}

export async function seedPreview(): Promise<SeedPreviewResult> {
  const started = Date.now()
  const result = await transaction(async (tx) => {
    const userId = await ensurePreviewUser(tx)
    await resetPreviewData(tx, userId)

    const taskCredits = await seedOwnTasks(tx, userId)
    await seedAdViews(tx, userId)
    await seedMissionClaims(tx, userId)
    const commissionCredits = await seedReferrals(tx, userId)
    await seedRivals(tx)

    /**
     * Saldo dinaikkan dulu ke target ditambah yang akan ditahan penarikan terbayar:
     * `users_balance_non_negative` membuat penahanan yang melebihi saldo saat itu bukan
     * angka minus melainkan `update` yang gagal dan menggagalkan seluruh seed.
     */
    const paidCredits = PAYOUTS.filter((payout) => payout.state === 'paid').reduce(
      (sum, payout) => sum + payout.credits,
      0,
    )
    await settleBalance(tx, userId, TARGET_BALANCE + paidCredits)
    await seedPayouts(tx, userId)
    const balance = await settleBalance(tx, userId, TARGET_BALANCE)

    await tx.query(
      `update users set first_name='Preview', energy=4, energy_updated_at=now(),
                        created_at = now() - interval '21 days', updated_at = now()
        where id = $1`,
      [userId],
    )

    return {
      userId,
      balance,
      taskCredits,
      commissionCredits,
      payouts: PAYOUTS.length,
      downlines: DOWNLINE_NAMES.length,
      rivals: RIVAL_NAMES.length,
    }
  })
  console.log(`[seed] selesai dalam ${Date.now() - started} ms`)
  return result
}
