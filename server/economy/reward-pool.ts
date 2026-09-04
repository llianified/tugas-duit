import type { PoolClient } from 'pg'
import {
  applyRewardPoolRefund,
  applyRewardPoolSpend,
  projectRewardPool,
  rewardPoolCapacity,
  type RewardPoolSnapshot,
  type RewardPoolState,
} from '@/domain/economy/reward-pool'
import { economyConfig, rankMinTasks } from '@/domain/economy/economy-config'
import { isPremiumActive } from '@/domain/economy/premium'
import { getRank } from '@/domain/progression/progression'
import { query } from '../platform/db'
import { STREAK_EXPRESSION } from './streak-sql'

export type RewardPoolView = RewardPoolState & { now: number }

type PoolRow = {
  reward_pool: number
  reward_pool_updated_at: Date
  premium_until: Date | null
  now: Date
}

const POOL_SELECT =
  'select reward_pool, reward_pool_updated_at, premium_until, now() as now from users where id=$1'

/** Kapasitas dibaca terpisah dari stoknya karena ia bukan milik user, melainkan turunan rank dan streak. Dua query, bukan satu: baris `users` perlu dikunci `for update` saat belanja, dan `for update` tidak bisa hidup satu query dengan agregat penghitung rank.
 *
 * Kedua turunannya DIBATASI, dan batasnya tidak mengubah satu pun hasil. Bonus streak jenuh di `maxStreakCapBonus` begitu rentetannya melewati `maxStreakCapBonus x streakCapStepDays` hari, jadi hari aktif di luar jendela itu tidak bisa lagi menggeser kapasitas — dan rank berhenti naik di ambang tier tertinggi, jadi menghitung completion melebihi ambang itu hanya membeli angka yang dibuang `getRank`. Tanpa batas ini biaya keduanya adalah seluruh umur akun, dibayar di setiap `/api/session`, `task/start`, dan `task/submit`: user paling setia justru yang merasakan aplikasi paling lambat. `$2` dan `$3` datang dari `economy_config`, bukan konstanta — plafonnya ikut bergeser kalau angkanya disetel dari panel. */
const CAPACITY_SQL = `with active_days as (
    select distinct (completed_at at time zone 'Asia/Jakarta')::date as day
      from task_completions
     where user_id=$1 and completed_at > now() - ($2::int * interval '1 day')
  ), today as (
    select (now() at time zone 'Asia/Jakarta')::date as day
  ), streak_days as (
    select day from active_days union select day from today
  ), ordered as (
    select day,(row_number() over(order by day desc))::int as rn from streak_days
  )
  select (select count(*) from
            (select 1 from task_completions where user_id=$1 limit $3::int) as capped)::int
           as completed_count,
         ${STREAK_EXPRESSION} as streak,
         (select premium_until from users where id=$1) as premium_until,
         now() as now`

/** Hari terjauh yang masih bisa menggeser bonus streak, plus sepekan kelonggaran untuk selisih
 * antara `now()` (UTC) dan batas hari WIB. */
function streakLookbackDays(): number {
  const config = economyConfig()
  return Math.max(1, config.maxStreakCapBonus) * Math.max(1, config.streakCapStepDays) + 7
}

/** Completion di atas ambang tier tertinggi tidak lagi menaikkan rank. */
const rankCountCap = () => Math.max(1, rankMinTasks(5))

const snapshotOf = (row: PoolRow): RewardPoolSnapshot => ({
  credits: Number(row.reward_pool),
  updatedAt: row.reward_pool_updated_at.getTime(),
})

async function run<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[],
  tx?: PoolClient,
): Promise<T[]> {
  return tx ? (await tx.query<T>(sql, params)).rows : query<T>(sql, params)
}

export async function readRewardPoolCapacity(userId: number, tx?: PoolClient): Promise<number> {
  const rows = await run<{
    completed_count: number
    streak: number
    premium_until: Date | null
    now: Date
  }>(CAPACITY_SQL, [userId, streakLookbackDays(), rankCountCap()], tx)
  const row = rows[0]
  if (!row) return rewardPoolCapacity({ rankTier: 1, streak: 0 })
  return rewardPoolCapacity({
    rankTier: getRank(Number(row.completed_count)).tier,
    streak: Number(row.streak),
    premium: isPremiumActive(
      row.premium_until ? row.premium_until.getTime() : null,
      row.now.getTime(),
    ),
  })
}

export async function readRewardPool(userId: number, tx?: PoolClient): Promise<RewardPoolView> {
  const [rows, capacity] = await Promise.all([
    run<PoolRow>(POOL_SELECT, [userId], tx),
    readRewardPoolCapacity(userId, tx),
  ])
  const row = rows[0]
  if (!row) return emptyView(capacity)
  const now = row.now.getTime()
  return { ...projectRewardPool(snapshotOf(row), capacity, now), now }
}

function emptyView(capacity: number): RewardPoolView {
  const now = Date.now()
  return { ...projectRewardPool({ credits: 0, updatedAt: now }, capacity, now), now }
}

/** Membayar sebanyak yang tersisa, tidak pernah lebih: reward yang lebih besar dari sisa kolam dipotong, bukan ditolak, supaya task terakhir sebelum kolam kosong tetap dibayar sebagian. */
export async function spendRewardPool(
  tx: PoolClient,
  userId: number,
  reward: number,
): Promise<{ paid: number; state: RewardPoolView }> {
  const capacity = await readRewardPoolCapacity(userId, tx)
  const locked = await tx.query<PoolRow>(`${POOL_SELECT} for update`, [userId])
  const row = locked.rows[0]
  if (!row) return { paid: 0, state: emptyView(capacity) }

  const now = row.now.getTime()
  const change = applyRewardPoolSpend(snapshotOf(row), capacity, now, reward)
  if (change.paid <= 0) return { paid: 0, state: { ...change.state, now } }

  await tx.query('update users set reward_pool=$2, reward_pool_updated_at=$3 where id=$1', [
    userId,
    change.snapshot.credits,
    new Date(change.snapshot.updatedAt),
  ])
  return { paid: change.paid, state: { ...change.state, now } }
}

/** Mengisi kembali kolam seorang user, dijepit di kapasitasnya. Dipakai panel admin untuk memulihkan user yang dirugikan gangguan — tanpa ini satu-satunya obat adalah koreksi saldo, yang mencetak credit alih-alih mengembalikan kesempatan menghasilkannya. Bentuknya mengikuti `spendRewardPool`: kapasitas dibaca terpisah, baris `users` dikunci `for update`, dan jam acuan regen digeser lewat `applyRewardPoolRefund` supaya menit yang belum genap tidak hangus. */
export async function refillRewardPool(
  tx: PoolClient,
  userId: number,
  credits: number,
): Promise<{ before: number; after: number; capacity: number }> {
  const capacity = await readRewardPoolCapacity(userId, tx)
  const locked = await tx.query<PoolRow>(`${POOL_SELECT} for update`, [userId])
  const row = locked.rows[0]
  if (!row) return { before: 0, after: 0, capacity }

  const now = row.now.getTime()
  const before = projectRewardPool(snapshotOf(row), capacity, now).current
  const change = applyRewardPoolRefund(snapshotOf(row), capacity, now, credits)

  await tx.query('update users set reward_pool=$2, reward_pool_updated_at=$3 where id=$1', [
    userId,
    change.snapshot.credits,
    new Date(change.snapshot.updatedAt),
  ])
  return { before, after: change.state.current, capacity }
}
