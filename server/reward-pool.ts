import type { PoolClient } from 'pg'
import {
  applyRewardPoolSpend,
  projectRewardPool,
  rewardPoolCapacity,
  type RewardPoolSnapshot,
  type RewardPoolState,
} from '@/domain/reward-pool'
import { getRank } from '@/features/home/progression'
import { query } from './db'
import { STREAK_EXPRESSION } from './streak-sql'

export type RewardPoolView = RewardPoolState & { now: number }

type PoolRow = { reward_pool: number; reward_pool_updated_at: Date; now: Date }

const POOL_SELECT =
  'select reward_pool, reward_pool_updated_at, now() as now from users where id=$1'

/**
 * Kapasitas dibaca terpisah dari stoknya karena ia bukan milik user, melainkan turunan rank
 * dan streak. Dua query, bukan satu: baris `users` perlu dikunci `for update` saat belanja,
 * dan `for update` tidak bisa hidup satu query dengan agregat penghitung rank.
 */
const CAPACITY_SQL = `with active_days as (
    select distinct (completed_at at time zone 'Asia/Jakarta')::date as day
      from task_completions where user_id=$1
  ), today as (
    select (now() at time zone 'Asia/Jakarta')::date as day
  ), streak_days as (
    select day from active_days union select day from today
  ), ordered as (
    select day,(row_number() over(order by day desc))::int as rn from streak_days
  )
  select (select count(*) from task_completions where user_id=$1)::int as completed_count,
         ${STREAK_EXPRESSION} as streak`

const snapshotOf = (row: PoolRow): RewardPoolSnapshot => ({
  credits: Number(row.reward_pool),
  updatedAt: row.reward_pool_updated_at.getTime(),
})

async function run<T extends Record<string, unknown>>(
  sql: string,
  userId: number,
  tx?: PoolClient,
): Promise<T[]> {
  return tx ? (await tx.query<T>(sql, [userId])).rows : query<T>(sql, [userId])
}

export async function readRewardPoolCapacity(userId: number, tx?: PoolClient): Promise<number> {
  const rows = await run<{ completed_count: number; streak: number }>(CAPACITY_SQL, userId, tx)
  const row = rows[0]
  if (!row) return rewardPoolCapacity({ rankTier: 1, streak: 0 })
  return rewardPoolCapacity({
    rankTier: getRank(Number(row.completed_count)).tier,
    streak: Number(row.streak),
  })
}

export async function readRewardPool(userId: number, tx?: PoolClient): Promise<RewardPoolView> {
  const [rows, capacity] = await Promise.all([
    run<PoolRow>(POOL_SELECT, userId, tx),
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

/**
 * Membayar sebanyak yang tersisa, tidak pernah lebih: reward yang lebih besar dari sisa kolam
 * dipotong, bukan ditolak, supaya task terakhir sebelum kolam kosong tetap dibayar sebagian.
 */
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
