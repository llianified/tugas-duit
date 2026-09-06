import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import type { PoolClient } from 'pg'
import {
  CHALLENGE_TITLE,
  generateChallenge,
  type Challenge,
  type Difficulty,
  type DistributiveOmit,
  type HistoryEntry,
  withVariantDefaults,
} from '@/domain/task/challenge'
import { getStarReward, getStars, type StarCount } from '@/domain/progression/stars'
import { economyConfig } from '@/domain/economy/economy-config'
import { consumeAdPass } from '../ads/ads'
import { query, transaction } from '../platform/db'
import { readEnergy, refundEntry, spendEnergy, type EnergyView } from '../economy/energy'
import { recordSubmitSignals, recordSubmitWithoutStart } from './fraud'
import { appendLedger } from '../economy/ledger'
import { accrueCommission } from '../economy/referral'
import { consumeQuota } from '../economy/quota'
import { readRewardPool, type RewardPoolView } from '../economy/reward-pool'

type PublicChallenge = Challenge
type ChallengePayload = DistributiveOmit<Challenge, 'id' | 'issuedAt' | 'startedAt' | 'expiresAt'>
type Row = {
  id: string
  type: Challenge['type']
  difficulty: Difficulty
  payload: ChallengePayload
  answer_hash: Buffer
  max_reward: number
  issued_at: Date
  started_at: Date | null
  expires_at: Date
  attempts: number
  submitted_at: Date | null
  ad_view_id: string | null
}
const hashAnswer = (id: string, answer: string) =>
  createHash('sha256').update(`${id}:${answer.trim().toUpperCase()}`).digest()
const toPublic = (row: Row): PublicChallenge => ({
  ...withVariantDefaults(row.payload),
  id: row.id,
  issuedAt: row.issued_at.getTime(),
  startedAt: row.started_at ? row.started_at.getTime() : null,
  expiresAt: row.expires_at.getTime(),
})

const PG_UNIQUE_VIOLATION = '23505'
const ACTIVE_CHALLENGE_SELECT =
  'select id,type,difficulty,payload,issued_at,started_at,expires_at from challenges where user_id=$1 and submitted_at is null and (started_at is null or expires_at>now()) limit 1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function issueChallenge(userId: number): Promise<PublicChallenge> {
  const existing = await query<Row>(ACTIVE_CHALLENGE_SELECT, [userId])
  if (existing[0]) return toPublic(existing[0])
  let inheritedDifficulty: Difficulty | undefined
  await transaction(async (tx) => {
    const closed = await tx.query<{ id: string; attempts: number; difficulty: Difficulty }>(
      'update challenges set submitted_at=now() where user_id=$1 and submitted_at is null and started_at is not null and expires_at<=now() returning id,attempts,difficulty',
      [userId],
    )
    for (const row of closed.rows) {
      if (Number(row.attempts) === 0) {
        await refundEntry(tx, userId, row.id)
        inheritedDifficulty ??= row.difficulty
      }
    }
  })
  const generated = generateChallenge({ difficulty: inheritedDifficulty }),
    id = randomUUID()
  const { answer, ...payload } = generated
  try {
    const rows = await query<Row>(
      `insert into challenges(id,user_id,type,difficulty,payload,answer_hash,max_reward,expires_at) values($1,$2,$3,$4,$5,$6,$7,now()+($8::int * interval '1 second')) returning id,type,difficulty,payload,issued_at,started_at,expires_at`,
      [
        id,
        userId,
        generated.type,
        generated.difficulty,
        JSON.stringify(payload),
        hashAnswer(id, answer),
        generated.maxReward,
        economyConfig().taskWindowSeconds,
      ],
    )
    return toPublic(rows[0])
  } catch (error) {
    if ((error as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw error
    const raced = await query<Row>(ACTIVE_CHALLENGE_SELECT, [userId])
    if (!raced[0]) throw error
    return toPublic(raced[0])
  }
}

export type TaskPayment = 'energy' | 'ad'

/** Yang benar-benar membayar ongkos masuk. Bukan selalu yang diminta klien: Pass Gaspol yang sedang
 * berjalan membayarkannya lebih dulu, tanpa pernah diminta dan tanpa memotong apa pun. Dipisah dari
 * `TaskPayment` supaya permintaan tetap cuma punya dua bentuk yang sah — 'gaspol' adalah jawaban,
 * bukan pilihan. */
export type TaskPaidBy = TaskPayment | 'gaspol'

type StartChallengeResult =
  | {
      ok: true
      challenge: PublicChallenge
      elapsedMs: number
      energy: EnergyView
      paidBy: TaskPaidBy
    }
  | {
      ok: false
      reason: 'not_startable' | 'energy_empty' | 'pool_empty' | 'ad_pass_missing'
      energy: EnergyView
    }

/** Pass Gaspol yang sedang berjalan. Jamnya `now()` milik Postgres, bukan `Date.now()` proses ini —
 * alasan yang sama dengan `expires_at` di atas: `gaspol_until` ditulis database, jadi selisih jam
 * kedua mesin tidak boleh masuk ke titik yang menentukan satu soal memotong energi atau tidak. */
async function gaspolActive(tx: PoolClient, userId: number): Promise<boolean> {
  const rows = await tx.query<{ active: boolean }>(
    'select coalesce(gaspol_until > now(), false) as active from users where id=$1',
    [userId],
  )
  return rows.rows[0]?.active === true
}

export async function startChallenge(
  userId: number,
  id: string,
  payWith: TaskPayment = 'energy',
): Promise<StartChallengeResult> {
  if (!id || !UUID_PATTERN.test(id))
    return { ok: false, reason: 'not_startable', energy: await readEnergy(userId) }

  return transaction(async (tx) => {
    const locked = await tx.query<Row & { now: Date }>(
      'select id,type,difficulty,payload,issued_at,started_at,expires_at,submitted_at,ad_view_id,now() as now from challenges where id=$1 and user_id=$2 for update',
      [id, userId],
    )
    const existing = locked.rows[0]
    /** Jam acuannya `now()` dari Postgres, bukan `new Date()` proses ini. `expires_at` ditulis database (`now()+interval`) dan `elapsed_ms` juga dihitung database, jadi membandingkannya dengan jam lambda memasukkan selisih jam kedua mesin tepat ke titik yang menentukan satu task dibayar atau ongkosnya dikembalikan. Bentuknya mengikuti `readEnergy`, `readRewardPool`, dan `claimAdTicket`, yang semuanya sudah membawa `now() as now` sendiri. */
    const startable =
      existing &&
      !existing.submitted_at &&
      (existing.started_at === null || existing.expires_at > existing.now)
    if (!startable)
      return {
        ok: false as const,
        reason: 'not_startable' as const,
        energy: await readEnergy(userId, tx),
      }

    const fresh = existing.started_at === null
    let adViewId: string | null = existing.ad_view_id
    /** Ongkos masuk yang benar-benar dibayar energi. Ikut menentukan `energy_spent_at` di update
     * bawah, dan itu yang menjaga `challenges_entry_refund_needs_entry`: soal yang dibayar Pass
     * Gaspol tidak memotong apa pun, jadi ia juga tidak boleh punya jejak ongkos yang bisa
     * dikembalikan. `refundEntry` sudah menyaring baris seperti itu keluar dengan sendirinya. */
    let paidWithEnergy = existing.ad_view_id === null
    if (fresh) {
      if ((await readRewardPool(userId, tx)).current <= 0)
        return {
          ok: false as const,
          reason: 'pool_empty' as const,
          energy: await readEnergy(userId, tx),
        }
      if (payWith === 'ad') {
        const pass = await consumeAdPass(tx, userId)
        if (!pass)
          return {
            ok: false as const,
            reason: 'ad_pass_missing' as const,
            energy: await readEnergy(userId, tx),
          }
        adViewId = pass.id
        paidWithEnergy = false
      } else if (await gaspolActive(tx, userId)) {
        /** Pass Gaspol dibaca SEBELUM energi dipotong, bukan sebagai jalur mundur setelah energinya
         * habis. Kalau ia cuma dipakai saat energi kosong, user yang membayar pass tetap kehilangan
         * energinya soal demi soal sampai habis — yang dibeli "energi tidak berkurang", bukan
         * "boleh main saat energi nol". */
        paidWithEnergy = false
      } else {
        const spent = await spendEnergy(tx, userId)
        if (!spent.ok)
          return { ok: false as const, reason: 'energy_empty' as const, energy: spent.state }
      }
    }

    const rows = await tx.query<Row & { elapsed_ms: number }>(
      `update challenges
         set started_at=coalesce(started_at,now()),
             expires_at=case when started_at is null then now()+($3::int * interval '1 second') else expires_at end,
             energy_spent_at=case when started_at is null and $5::boolean then now() else energy_spent_at end,
             ad_view_id=case when started_at is null then $4::uuid else ad_view_id end
       where id=$1 and user_id=$2
       returning id,type,difficulty,payload,issued_at,started_at,expires_at,(extract(epoch from(now()-started_at))*1000)::int elapsed_ms`,
      [id, userId, economyConfig().taskWindowSeconds, adViewId, paidWithEnergy],
    )
    const row = rows.rows[0]
    return {
      ok: true as const,
      challenge: toPublic(row),
      elapsedMs: Math.max(0, row.elapsed_ms),
      energy: await readEnergy(userId, tx),
      paidBy: (adViewId !== null ? 'ad' : paidWithEnergy ? 'energy' : 'gaspol') as TaskPaidBy,
    }
  })
}
type SubmitResult =
  /** `pool` dan `entry` ikut pulang bukan sebagai kemewahan: tanpa keduanya klien menyegarkan
   * sesi dan riwayat lewat dua permintaan lagi untuk data yang sudah ada di tangan transaksi ini.
   * Keduanya dibaca dari nilai yang memang sudah dihitung di sini, bukan dari kueri tambahan. */
  | {
      ok: true
      stars: StarCount
      reward: number
      balance: number
      elapsedMs: number
      pool: RewardPoolView
      entry: HistoryEntry
    }
  | { ok: false; reason: 'wrong'; attemptsLeft: number }
  | {
      ok: false
      reason:
        | 'expired'
        | 'not_found'
        | 'not_started'
        | 'already_submitted'
        | 'too_many_attempts'
        | 'pool_empty'
        | 'daily_task_cap'
    }
export async function submitAnswer(
  userId: number,
  id: string,
  input: string,
): Promise<SubmitResult> {
  if (!id || !UUID_PATTERN.test(id)) return { ok: false, reason: 'not_found' }
  if (typeof input !== 'string' || input.length > 32) return { ok: false, reason: 'not_found' }
  return transaction(async (tx) => {
    const result = await tx.query<Row & { now: Date }>(
      'select id,type,difficulty,payload,answer_hash,max_reward,attempts,submitted_at,issued_at,started_at,expires_at,now() as now from challenges where id=$1 and user_id=$2 for update',
      [id, userId],
    )
    const c = result.rows[0]
    if (!c) return { ok: false, reason: 'not_found' }
    if (c.submitted_at) return { ok: false, reason: 'already_submitted' }
    if (!c.started_at) {
      await recordSubmitWithoutStart(tx, userId, { challengeId: id })
      return { ok: false, reason: 'not_started' }
    }
    if (c.expires_at <= c.now) {
      await tx.query('update challenges set submitted_at=now() where id=$1', [id])
      if (Number(c.attempts) === 0) await refundEntry(tx, userId, id)
      return { ok: false, reason: 'expired' }
    }
    const maxAttempts = economyConfig().maxAttemptsPerTask
    if (c.attempts >= maxAttempts) {
      await tx.query('update challenges set submitted_at=now() where id=$1', [id])
      return { ok: false, reason: 'too_many_attempts' }
    }
    const incoming = hashAnswer(id, input)
    if (incoming.length !== c.answer_hash.length || !timingSafeEqual(incoming, c.answer_hash)) {
      const bumped = await tx.query<{ attempts: number }>(
        `update challenges
         set attempts=attempts+1,
             submitted_at=case when attempts+1 >= $2 then now() else submitted_at end
         where id=$1
         returning attempts`,
        [id, maxAttempts],
      )
      return { ok: false, reason: 'wrong', attemptsLeft: maxAttempts - bumped.rows[0].attempts }
    }
    const marked = await tx.query<{ elapsed_ms: number }>(
      `update challenges set submitted_at=now() where id=$1 returning (extract(epoch from(now()-coalesce(started_at,issued_at)))*1000)::int elapsed_ms`,
      [id],
    )
    const elapsedMs = marked.rows[0].elapsed_ms
    const stars = getStars(elapsedMs, c.difficulty, withVariantDefaults(c.payload).parScale),
      reward = Math.min(getStarReward(c.difficulty, stars), c.max_reward)
    const quota = await consumeQuota(tx, userId, reward)
    if (quota.refusal) {
      await refundEntry(tx, userId, id)
      return { ok: false, reason: quota.refusal === 'pool_empty' ? 'pool_empty' : 'daily_task_cap' }
    }
    const paidReward = quota.paidReward

    /** `solved` ditulis SETELAH kuota membayar, bukan bersamaan dengan `submitted_at`. Jawaban yang benar tapi tidak dibayar (kolam kosong / plafon harian) tetap soal yang ditutup, bukan soal yang selesai: tidak ada baris `task_completions` maupun ledger untuknya. Menandainya `solved` membuat hitungan admin tidak cocok dengan jumlah completion, dan membuatnya luput dari sapuan `runMaintenance` yang memang hanya menghapus soal ber-`solved = false`. */
    await tx.query('update challenges set solved=true where id=$1', [id])
    const completion = await tx.query<{ id: string; completed_at: Date }>(
      `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward) values($1,$2,$3,$4,$5,$6,$7) returning id,completed_at`,
      [userId, id, c.type, c.difficulty, elapsedMs, stars, paidReward],
    )
    const ledger = await appendLedger(tx, {
      userId,
      kind: 'task',
      amount: paidReward,
      idempotencyKey: `task:${id}`,
      referenceId: completion.rows[0].id,
    })
    await accrueCommission(tx, {
      downlineId: userId,
      completionId: completion.rows[0].id,
      reward: paidReward,
    })
    await recordSubmitSignals(tx, userId, { difficulty: c.difficulty, elapsedMs, challengeId: id })
    return {
      ok: true,
      stars,
      reward: paidReward,
      balance: ledger.balance,
      elapsedMs,
      pool: quota.pool,
      entry: {
        id: completion.rows[0].id,
        title: CHALLENGE_TITLE[c.type],
        difficulty: c.difficulty,
        reward: paidReward,
        stars,
        completedAt: completion.rows[0].completed_at.getTime(),
      },
    }
  })
}
