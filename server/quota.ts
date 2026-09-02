import type { PoolClient } from 'pg'
import { dailyCommissionCreditCap, maxTasksPerDay } from '@/domain/economy'
import { isPremium } from './premium'
import { readRewardPool, spendRewardPool, type RewardPoolView } from './reward-pool'

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"

export type QuotaRefusal = 'daily_task_cap' | 'pool_empty'

interface QuotaResult {
  refusal: QuotaRefusal | null
  paidReward: number
  pool: RewardPoolView
}

/** Yang tersisa di `daily_quotas` sekarang cuma dua hal yang memang harian: `tasks_completed` sebagai jaring anti-bot, dan `commission_credits` sebagai plafon komisi referral. `credits_earned` tetap ditulis sebagai catatan yang dibaca panel admin — kolam reward (`users.reward_pool`) yang menahan pembayaran, bukan kolom ini. */
export async function consumeQuota(
  tx: PoolClient,
  userId: number,
  reward: number,
): Promise<QuotaResult> {
  const maxTasks = maxTasksPerDay(await isPremium(userId, tx))
  const counted = await tx.query<{ tasks_completed: number }>(
    `insert into daily_quotas(user_id,quota_date,tasks_completed)
     values($1,${TODAY},1)
     on conflict(user_id,quota_date) do update
       set tasks_completed=daily_quotas.tasks_completed+1
     returning tasks_completed`,
    [userId],
  )
  /** Penghitung dinaikkan lebih dulu supaya kenaikannya ikut terkunci baris `daily_quotas` yang sama, lalu dikembalikan kalau task-nya ternyata tidak dibayar. Tanpa pengembalian ini `tasks_completed` naik untuk setiap penolakan juga, sehingga jaring anti-bot menghitung percobaan alih-alih task yang benar-benar dibayar — dan user yang menabrak plafon sekali tidak akan pernah turun lagi dari plafon itu di hari yang sama. */
  const rollback = () =>
    tx.query(
      `update daily_quotas set tasks_completed=greatest(0, tasks_completed-1)
        where user_id=$1 and quota_date=${TODAY}`,
      [userId],
    )

  if (Number(counted.rows[0].tasks_completed) > maxTasks) {
    await rollback()
    return { refusal: 'daily_task_cap', paidReward: 0, pool: await readRewardPool(userId, tx) }
  }

  const spent = await spendRewardPool(tx, userId, reward)
  if (spent.paid <= 0) {
    await rollback()
    return { refusal: 'pool_empty', paidReward: 0, pool: spent.state }
  }

  await tx.query(
    `update daily_quotas set credits_earned=credits_earned+$2
      where user_id=$1 and quota_date=${TODAY}`,
    [userId, spent.paid],
  )
  return { refusal: null, paidReward: spent.paid, pool: spent.state }
}

export async function consumeCommissionQuota(
  tx: PoolClient,
  uplineId: number,
  credits: number,
): Promise<number> {
  if (credits <= 0) return 0

  const locked = await tx.query<{ commission_credits: number }>(
    `insert into daily_quotas(user_id,quota_date,commission_credits)
     values($1,${TODAY},0)
     on conflict(user_id,quota_date) do update
       set commission_credits=daily_quotas.commission_credits
     returning commission_credits`,
    [uplineId],
  )
  const earned = Number(locked.rows[0].commission_credits)
  const payable = Math.min(credits, Math.max(0, dailyCommissionCreditCap() - earned))
  if (payable <= 0) return 0

  await tx.query(
    `update daily_quotas set commission_credits=commission_credits+$2
      where user_id=$1 and quota_date=${TODAY}`,
    [uplineId, payable],
  )
  return payable
}
