import { channelBonusEnabled, channelJoinBonusCredits } from '@/domain/economy'
import { query, transaction } from './db'
import { env } from './env'
import { appendLedger } from './ledger'
import { readChannelMembership } from './telegram'

export interface ChannelBonusState {
  enabled: boolean
  url: string
  credits: number
  claimed: boolean
}

export async function readChannelBonusState(userId: number): Promise<ChannelBonusState> {
  const rows = await query<{ channel_bonus_claimed_at: Date | null }>(
    'select channel_bonus_claimed_at from users where id=$1',
    [userId],
  )
  return {
    enabled: channelBonusEnabled(),
    url: env.telegramChannelUrl,
    credits: channelJoinBonusCredits(),
    claimed: Boolean(rows[0]?.channel_bonus_claimed_at),
  }
}

export type ChannelClaimResult =
  | { ok: true; credits: number; balance: number }
  | { ok: false; reason: 'disabled' | 'already_claimed' | 'not_member' | 'unverifiable' }

/**
 * Keanggotaan diperiksa ke Telegram lebih dulu, di luar transaksi, karena panggilan
 * jaringan tidak boleh memegang `for update` pada baris `users` — aturan yang sama
 * dengan alasan pesan bot dikirim dari cron, bukan dari alur yang memicunya.
 *
 * Yang menjamin bonus tidak turun dua kali bukan kolom penanda, melainkan
 * `credit_ledger.idempotency_key`: penandanya bisa saja kalah balapan, kuncinya tidak.
 */
export async function claimChannelBonus(
  userId: number,
  telegramId: string,
): Promise<ChannelClaimResult> {
  if (!channelBonusEnabled()) return { ok: false, reason: 'disabled' }

  const claimed = await query<{ channel_bonus_claimed_at: Date | null }>(
    'select channel_bonus_claimed_at from users where id=$1',
    [userId],
  )
  if (claimed[0]?.channel_bonus_claimed_at) return { ok: false, reason: 'already_claimed' }

  const member = await readChannelMembership(telegramId)
  if (member === null) return { ok: false, reason: 'unverifiable' }
  if (!member) return { ok: false, reason: 'not_member' }

  const credits = channelJoinBonusCredits()
  return transaction(async (tx) => {
    const marked = await tx.query(
      'update users set channel_bonus_claimed_at=now() where id=$1 and channel_bonus_claimed_at is null',
      [userId],
    )
    if (marked.rowCount === 0) return { ok: false as const, reason: 'already_claimed' as const }

    const ledger = await appendLedger(tx, {
      userId,
      kind: 'adjustment',
      amount: credits,
      idempotencyKey: `channel_bonus:${userId}`,
      note: `Bonus join channel ${env.telegramChannelId}`,
    })
    return { ok: true as const, credits, balance: ledger.balance }
  })
}
