import type { PoolClient } from 'pg'
import type { Difficulty } from '@/features/captcha/domain'

type FraudSignal =
  | 'impossibly_fast'
  | 'submit_without_start'
  | 'identical_timing'
  | 'no_wrong_attempts'
  | 'referral_burst'
  | 'ad_claim_without_ticket'
  | 'ad_claim_too_fast'
  | 'ad_claim_burst'

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

export async function recordAdClaimSignal(
  tx: PoolClient,
  userId: number,
  signal: 'ad_claim_without_ticket' | 'ad_claim_too_fast' | 'ad_claim_burst',
  detail: unknown,
): Promise<void> {
  await tx.query(
    `insert into fraud_signals(user_id,signal,severity,detail)
     select $1,$2,3,$3::jsonb
     where not exists (
       select 1 from fraud_signals f
       where f.user_id=$1 and f.signal=$2
         and f.created_at > now() - interval '1 day'
     )`,
    [userId, signal, JSON.stringify(detail)],
  )
}

/**
 * Ambang sapuan, dikalibrasi dari sebaran nyata di produksi (36.033 task sejak 19 Agu),
 * bukan dari tebakan. Angka-angka ini tinggal di kode dan bukan di panel admin karena
 * sinyal hanya mencatat — tidak pernah mengubah reward maupun menolak pembayaran —
 * sesuai baris `FLOOR_MS` di `docs/keputusan-desain.md`.
 */

/** Sampel minimum sebelum keseragaman waktu berarti apa-apa. */
const IDENTICAL_TIMING_MIN_SAMPLE = 50

/**
 * Ambang lama 150ms tidak pernah bisa disentuh: `elapsed_ms` mengukur waktu manusia
 * membaca soal, bukan latensi mesin, dan spread terkecil di seluruh dataset produksi
 * adalah 1.877ms — 12x di atas ambangnya. 600ms memberi jarak ~3x di bawah lantai
 * manusia paling konsisten, sambil menangkap skrip ber-jitter yang dulu lolos.
 */
const IDENTICAL_TIMING_MAX_SPREAD_MS = 600

const NO_WRONG_MIN_SOLVED = 200

/**
 * Dulu syaratnya `max(attempts) = 0` — rekor sempurna. Itu bisa dimatikan permanen oleh
 * SATU jawaban salah yang disengaja, jadi diganti rasio. Populasi produksi rata-rata
 * ~6,5% percobaan salah per task; 1% menandai yang enam kali lebih bersih dari itu dan
 * memaksa pengelak membuang dua task per dua ratus, bukan satu.
 */
const NO_WRONG_MAX_ERROR_RATIO = 0.01

/**
 * Rentang yang disapu harus LEBIH PANJANG dari periode cron, kalau tidak detektornya buta
 * di sela antar-jalan. Versi lama memakai jendela 10 menit sementara cron jalan tiap jam
 * (`railway.cron.json`), jadi 50 dari 60 menit tidak pernah terlihat — burst 34 akun pada
 * 25 Agu 09:13–09:16 lolos bukan karena ambangnya kurang, tapi karena tidak ada satu pun
 * eksekusi yang jendelanya menutupi menit-menit itu. Tiga jam memberi ruang untuk cron
 * yang telat atau satu-dua eksekusi yang terlewat.
 */
/**
 * Harus lebih panjang daripada jarak antar-jalan cron, plus margin. Kalau lebih pendek,
 * selisihnya jadi lubang buta permanen: sapuan tidak akan pernah melihat apa yang terjadi
 * di antara dua jalan. 25 jam menutupi cron harian di `vercel.json` dengan margin satu jam.
 * FRAUD-4 mengunci kaitan ini — kalau jadwal cron-nya dipercepat lagi, test itu yang
 * memberi tahu berapa nilai yang masih sah.
 */
const REFERRAL_BURST_LOOKBACK_MINUTES = 1_500

/**
 * Kerapatan yang dicari tetap sama seperti dulu — sekian pendaftar dalam sepuluh menit —
 * hanya saja sekarang dicari di SETIAP titik sepanjang rentang sapuan, bukan hanya di
 * sepuluh menit terakhir. Melebarkan jendelanya saja akan menumpulkan artinya: 20
 * pendaftar dalam tiga jam itu wajar, 20 dalam sepuluh menit tidak.
 */
const REFERRAL_BURST_WINDOW_MINUTES = 10

const REFERRAL_BURST_THRESHOLD = 20

export const SWEEP_THRESHOLDS = {
  identicalTimingMinSample: IDENTICAL_TIMING_MIN_SAMPLE,
  identicalTimingMaxSpreadMs: IDENTICAL_TIMING_MAX_SPREAD_MS,
  noWrongMinSolved: NO_WRONG_MIN_SOLVED,
  noWrongMaxErrorRatio: NO_WRONG_MAX_ERROR_RATIO,
  referralBurstLookbackMinutes: REFERRAL_BURST_LOOKBACK_MINUTES,
  referralBurstWindowMinutes: REFERRAL_BURST_WINDOW_MINUTES,
  referralBurstThreshold: REFERRAL_BURST_THRESHOLD,
} as const

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
       having count(*) >= ${IDENTICAL_TIMING_MIN_SAMPLE}
          and stddev(tc.elapsed_ms) < ${IDENTICAL_TIMING_MAX_SPREAD_MS}
     ) c
     where not exists (
       select 1 from fraud_signals f
       where f.user_id=c.user_id and f.signal='identical_timing'
         and f.created_at > now() - interval '1 day'
     )`,
  )

  const noWrongAttempts = await tx.query(
    `insert into fraud_signals(user_id,signal,severity,detail)
     select c.user_id,'no_wrong_attempts',3,
       jsonb_build_object('solved',c.solved,'salah',c.salah,'rasioSalah',round(c.rasio,4))
     from (
       select ch.user_id,
              count(*) solved,
              coalesce(sum(ch.attempts),0) salah,
              coalesce(sum(ch.attempts),0)::numeric / count(*) rasio
       from challenges ch
       join users u on u.id=ch.user_id and u.banned_at is null
       where ch.solved and ch.submitted_at > now() - interval '7 days'
       group by ch.user_id
       having count(*) >= ${NO_WRONG_MIN_SOLVED}
          and coalesce(sum(ch.attempts),0)::numeric / count(*) < ${NO_WRONG_MAX_ERROR_RATIO}
     ) c
     where not exists (
       select 1 from fraud_signals f
       where f.user_id=c.user_id and f.signal='no_wrong_attempts'
         and f.created_at > now() - interval '1 day'
     )`,
  )

  const referralBurst = await tx.query(
    `insert into fraud_signals(user_id,signal,severity,detail)
     select c.referred_by,'referral_burst',4,
       jsonb_build_object(
         'pendaftar',c.pendaftar,
         'windowMinutes',${REFERRAL_BURST_WINDOW_MINUTES},
         'lookbackMinutes',${REFERRAL_BURST_LOOKBACK_MINUTES},
         'terakhirDaftar',c.terakhir
       )
     from (
       select w.referred_by,max(w.in_window) pendaftar,max(w.created_at) terakhir
       from (
         select u.referred_by,
                u.created_at,
                count(*) over (
                  partition by u.referred_by
                  order by u.created_at
                  range between interval '${REFERRAL_BURST_WINDOW_MINUTES} minutes' preceding
                            and current row
                )::int in_window
         from users u
         join users up on up.id=u.referred_by and up.banned_at is null
         where u.referred_by is not null
           and u.created_at > now() - interval '${REFERRAL_BURST_LOOKBACK_MINUTES} minutes'
       ) w
       group by w.referred_by
       having max(w.in_window) >= ${REFERRAL_BURST_THRESHOLD}
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
