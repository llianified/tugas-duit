import { query } from '../platform/db'
import {
  requiredActiveDays,
  requiredActiveReferrals,
  withdrawalCooldownMsForBase,
} from '../payout/payout-rules'
import { generateReferralCode } from '../economy/referral'

/** Perkakas khusus uji, bukan jalur produksi: `createPayout` menuntut hari aktif, referral aktif, dan cooldown, jadi berkas uji mana pun yang menyentuh penarikan harus menyiapkan ketiganya dulu. Dikumpulkan di sini supaya syaratnya cukup diperbarui sekali kalau gatingnya berubah — bukan disalin ke tiap `*.test.ts`. */
export async function seedActiveReferrals(
  uplineId: number,
  count = requiredActiveReferrals(),
): Promise<void> {
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  for (let index = 0; index < count; index += 1) {
    const downline = await query<{ id: string }>(
      `insert into users(telegram_id,first_name,referral_code,referred_by)
       values($1,'Referral aktif',$2,$3) returning id`,
      [700_100_000_000_000 + suffix * 10 + index, generateReferralCode(), uplineId],
    )
    const challenge = await query<{ id: string }>(
      `insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,expires_at,submitted_at,solved)
       values($1,'text','Easy','{}','\\x00',1,now(),now(),true) returning id`,
      [downline[0].id],
    )
    const completion = await query<{ id: string }>(
      `insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward)
       values($1,$2,'text','Easy',1000,3,1) returning id`,
      [downline[0].id, challenge[0].id],
    )
    await query(
      `insert into referral_commissions(upline_id,downline_id,task_completion_id,reward,commission_units)
       values($1,$2,$3,1,1)`,
      [uplineId, downline[0].id, completion[0].id],
    )
  }
}

/** Memundurkan pengajuan yang sudah ada supaya cooldown 7 hari tidak menghalangi uji berikutnya. */
export async function clearWithdrawalCooldown(userId: number): Promise<void> {
  await query(
    `update withdrawals set requested_at=now()-($2::bigint * interval '1 millisecond')
      where user_id=$1`,
    [userId, withdrawalCooldownMsForBase() + 60_000],
  )
}

/** Menyiapkan hari aktif: satu task selesai per hari WIB berbeda, mundur dari kemarin. Batas harinya harus sama persis dengan `ELIGIBILITY_SQL` di `payout.ts` — keduanya memakai `(completed_at at time zone 'Asia/Jakarta')::date`. */
export async function seedActiveDays(
  userId: number,
  days = requiredActiveDays(),
): Promise<void> {
  if (days <= 0) return
  await query(
    `with baru as (
       insert into challenges(user_id,type,difficulty,payload,answer_hash,max_reward,
                              expires_at,submitted_at,solved)
       select $1,'text','Easy','{}','\\x00',1,now(),now(),true from generate_series(1,$2) g
       returning id
     ), bernomor as (
       select id, (row_number() over ())::int rn from baru
     )
     insert into task_completions(user_id,challenge_id,type,difficulty,elapsed_ms,stars,reward,completed_at)
     select $1, id, 'text', 'Easy', 1000, 3, 1, now() - (rn * interval '1 day') from bernomor`,
    [userId, days],
  )
}

/** Semua syarat kelayakan penarikan sekaligus. Ini yang dipakai berkas uji yang cuma perlu lolos gerbang tanpa peduli syarat mana yang sedang diuji — jadi saat gerbangnya bertambah, yang berubah cukup fungsi ini, bukan setiap `*.test.ts` yang menyentuh penarikan. */
export async function seedWithdrawalEligibility(userId: number): Promise<void> {
  await seedActiveReferrals(userId)
  await seedActiveDays(userId)
}
