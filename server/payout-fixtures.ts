import { query } from './db'
import { REQUIRED_ACTIVE_REFERRALS, WITHDRAWAL_COOLDOWN_MS } from './payout-rules'
import { generateReferralCode } from './referral'

/**
 * Perkakas khusus uji, bukan jalur produksi: `createPayout` menuntut referral aktif dan
 * cooldown 7 hari, jadi berkas uji mana pun yang menyentuh penarikan harus menyiapkan
 * dua hal itu dulu. Dikumpulkan di sini supaya syaratnya cukup diperbarui sekali kalau
 * gatingnya berubah — bukan disalin ke tiap `*.test.ts`.
 */
export async function seedActiveReferrals(
  uplineId: number,
  count = REQUIRED_ACTIVE_REFERRALS,
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
    [userId, WITHDRAWAL_COOLDOWN_MS + 60_000],
  )
}
