import type { PoolClient } from 'pg'
import type { Difficulty } from '@/features/captcha/domain'

type FraudSignal =
  | 'impossibly_fast'
  | 'submit_without_start'
  | 'identical_timing'
  | 'no_wrong_attempts'
  | 'referral_burst'

type Severity = 1 | 2 | 3 | 4 | 5

async function recordSignal(
  tx: PoolClient,
  userId: number,
  signal: FraudSignal,
  severity: Severity,
  detail?: unknown,
): Promise<void> {
  await tx.query(
    'insert into fraud_signals(user_id,signal,severity,detail) values($1,$2,$3,$4)',
    [userId, signal, severity, detail === undefined ? null : JSON.stringify(detail)],
  )
}

const FLOOR_MS: Record<Difficulty, number> = {
  Easy: 700,
  Medium: 1_000,
  Hard: 1_200,
}

export async function recordSubmitSignals(
  tx: PoolClient,
  userId: number,
  submission: { difficulty: Difficulty; elapsedMs: number; challengeId: string },
): Promise<void> {
  const floor = FLOOR_MS[submission.difficulty]
  if (submission.elapsedMs < floor) {
    await recordSignal(tx, userId, 'impossibly_fast', 4, {
      elapsedMs: submission.elapsedMs,
      floorMs: floor,
      difficulty: submission.difficulty,
      challengeId: submission.challengeId,
    })
  }
}

export async function recordSubmitWithoutStart(
  tx: PoolClient,
  userId: number,
  detail: { challengeId: string },
): Promise<void> {
  await tx.query(
    `insert into fraud_signals(user_id,signal,severity,detail)
     select $1,'submit_without_start',4,$2::jsonb
     where not exists (
       select 1 from fraud_signals f
       where f.user_id=$1 and f.signal='submit_without_start'
         and f.created_at > now() - interval '1 day'
     )`,
    [userId, JSON.stringify(detail)],
  )
}

type SweepCounts = Record<'identical_timing' | 'no_wrong_attempts' | 'referral_burst', number>

export async function sweepFraudSignals(tx: PoolClient): Promise<SweepCounts> {
  const identicalTiming = await tx.query(
    `insert into fraud_signals(user_id,signal,severity,detail)
     select c.user_id,'identical_timing',3,
       jsonb_build_object('difficulty',c.difficulty,'sample',c.sample,'spreadMs',round(c.spread),'meanMs',round(c.mean))
     from (
       select tc.user_id,tc.difficulty,count(*) sample,stddev(tc.elapsed_ms) spread,avg(tc.elapsed_ms) mean
       from task_completions tc
       join users u on u.id=tc.user_id and u.banned_at is null
       where tc.completed_at > now() - interval '1 day'
       group by tc.user_id,tc.difficulty
       having count(*) >= 50 and stddev(tc.elapsed_ms) < 150
     ) c
     where not exists (
       select 1 from fraud_signals f
       where f.user_id=c.user_id and f.signal='identical_timing'
         and f.created_at > now() - interval '1 day'
     )`,
  )

  const noWrongAttempts = await tx.query(
    `insert into fraud_signals(user_id,signal,severity,detail)
     select c.user_id,'no_wrong_attempts',3,jsonb_build_object('solved',c.solved)
     from (
       select ch.user_id,count(*) solved
       from challenges ch
       join users u on u.id=ch.user_id and u.banned_at is null
       where ch.solved and ch.submitted_at > now() - interval '7 days'
       group by ch.user_id
       having count(*) >= 200 and max(ch.attempts) = 0
     ) c
     where not exists (
       select 1 from fraud_signals f
       where f.user_id=c.user_id and f.signal='no_wrong_attempts'
         and f.created_at > now() - interval '1 day'
     )`,
  )

  const referralBurst = await tx.query(
    `insert into fraud_signals(user_id,signal,severity,detail)
     select c.referred_by,'referral_burst',4,jsonb_build_object('pendaftar',c.pendaftar,'windowMinutes',10)
     from (
       select u.referred_by,count(*) pendaftar
       from users u
       join users up on up.id=u.referred_by and up.banned_at is null
       where u.referred_by is not null and u.created_at > now() - interval '10 minutes'
       group by u.referred_by
       having count(*) >= 20
     ) c
     where not exists (
       select 1 from fraud_signals f
       where f.user_id=c.referred_by and f.signal='referral_burst'
         and f.created_at > now() - interval '1 day'
     )`,
  )

  return {
    identical_timing: identicalTiming.rowCount ?? 0,
    no_wrong_attempts: noWrongAttempts.rowCount ?? 0,
    referral_burst: referralBurst.rowCount ?? 0,
  }
}
