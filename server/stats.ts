
import type { Difficulty } from '@/features/captcha/domain'
import { getUserStats, type DifficultyTally, type UserStats } from '@/features/stats/domain'
import { STAR_MAX } from '@/domain/stars'
import { query } from './db'
import { STREAK_EXPRESSION } from './streak-sql'

const TIME_ZONE = 'Asia/Jakarta'

const EMPTY_TALLY: Record<Difficulty, DifficultyTally> = {
  Easy: { count: 0, credits: 0 },
  Medium: { count: 0, credits: 0 },
  Hard: { count: 0, credits: 0 },
}

export async function getStats(userId: number, balance: number): Promise<UserStats> {
  const [totals, difficulties, money, payouts, referrals] = await Promise.all([
    query<{
      completed_count: number
      today_count: number
      total_stars: number
      perfect_count: number
      best_reward: number
      first_completed_at: Date | null
      last_completed_at: Date | null
      active_days: number
      streak: number
    }>(
      `with entries as (
         select completed_at, stars, reward, (completed_at at time zone $2)::date as day
           from task_completions
          where user_id = $1
       ),
       today as (select (now() at time zone $2)::date as day),
       active as (select distinct day from entries),
       -- Hari ini selalu ikut sebagai hari aktif, walau belum ada task-nya:
       -- membuka aplikasi hari ini belum gagal, ia baru dimulai, dan streak yang
       -- lenyap setiap pagi adalah kabar buruk yang tidak benar. Lewat 'union'
       -- (bukan '+1' di ujung hitungan) supaya bolong tetap bolong: membuka
       -- aplikasi setelah tiga hari absen mengembalikan 1, bukan angka lama.
       streak_days as (select day from active union select day from today),
       ordered as (select day, (row_number() over (order by day desc))::int as rn from streak_days)
       select (select count(*) from entries)::int                                as completed_count,
              (select count(*) from entries
                where day = (select day from today))::int                        as today_count,
              (select coalesce(sum(stars), 0) from entries)::int                 as total_stars,
              (select count(*) from entries where stars = $3)::int               as perfect_count,
              (select coalesce(max(reward), 0) from entries)::int                as best_reward,
              (select min(completed_at) from entries)                            as first_completed_at,
              (select max(completed_at) from entries)                            as last_completed_at,
              (select count(*) from active)::int                                 as active_days,
              ${STREAK_EXPRESSION}                                               as streak`,
      [userId, TIME_ZONE, STAR_MAX],
    ),
    query<{ difficulty: Difficulty; count: number; credits: number }>(
      `select difficulty,
              count(*)::int                   as count,
              coalesce(sum(reward), 0)::int   as credits
         from task_completions
        where user_id = $1
        group by difficulty`,
      [userId],
    ),
    query<{ task_credits: number; referral_credits: number }>(
      `select coalesce(sum(amount) filter (where kind = 'task'), 0)::int       as task_credits,
              coalesce(sum(amount) filter (where kind = 'commission'), 0)::int as referral_credits
         from credit_ledger
        where user_id = $1`,
      [userId],
    ),
    query<{
      payout_count: number
      paid_count: number
      processing_count: number
      withdrawn_credits: number
      processing_credits: number
    }>(
      `select count(*)::int                                                    as payout_count,
              (count(*) filter (where state = 'paid'))::int                    as paid_count,
              (count(*) filter (where state = 'processing'))::int              as processing_count,
              coalesce(sum(credits) filter (where state = 'paid'), 0)::int       as withdrawn_credits,
              coalesce(sum(credits) filter (where state = 'processing'), 0)::int as processing_credits
         from withdrawals
        where user_id = $1`,
      [userId],
    ),
    query<{
      referral_count: number
      active_referral_count: number
      downline_tasks: number
      joined_at: Date | null
    }>(
      `select (select created_at from users where id = $1)                             as joined_at,
              (select count(*) from users where referred_by = $1)::int                  as referral_count,
              (select count(distinct downline_id) from referral_commissions
                where upline_id = $1)::int                                              as active_referral_count,
              (select count(*) from referral_commissions where upline_id = $1)::int      as downline_tasks`,
      [userId],
    ),
  ])

  const totalRow = totals[0]
  const byDifficulty = { ...EMPTY_TALLY }
  for (const row of difficulties) {
    byDifficulty[row.difficulty] = { count: row.count, credits: row.credits }
  }

  return getUserStats({
    joinedAt: referrals[0].joined_at?.getTime() ?? null,
    completedCount: totalRow.completed_count,
    todayCount: totalRow.today_count,
    totalStars: totalRow.total_stars,
    perfectCount: totalRow.perfect_count,
    bestReward: totalRow.best_reward,
    firstCompletedAt: totalRow.first_completed_at?.getTime() ?? null,
    lastCompletedAt: totalRow.last_completed_at?.getTime() ?? null,
    activeDays: totalRow.active_days,
    streak: totalRow.streak,
    byDifficulty,

    taskCredits: money[0].task_credits,
    referralCredits: money[0].referral_credits,
    withdrawnCredits: payouts[0].withdrawn_credits,
    processingCredits: payouts[0].processing_credits,
    balance,

    referralCount: referrals[0].referral_count,
    activeReferralCount: referrals[0].active_referral_count,
    downlineTasks: referrals[0].downline_tasks,
    payoutCount: payouts[0].payout_count,
    paidPayoutCount: payouts[0].paid_count,
    processingPayoutCount: payouts[0].processing_count,
  })
}
