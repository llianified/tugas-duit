import { channelBonusEnabled, channelGateRequired, channelJoinBonusCredits } from '@/domain/economy'
import { query, transaction } from './db'
import { env } from './env'
import { appendLedger } from './ledger'
import { readChannelMembership } from './telegram'

const MEMBER_TTL_MS = 6 * 3_600_000
const NON_MEMBER_TTL_MS = 60_000
const OUTAGE_BACKOFF_MS = 30_000

let outageUntil = 0

export interface ChannelGateState {
  required: boolean
  member: boolean
  url: string
}

export interface ChannelGateUser {
  id: number
  telegramId: string
  channelMember: boolean | null
  channelCheckedAt: Date | null
}

function cachedMembership(user: ChannelGateUser, now: number): boolean | null {
  if (user.channelMember === null || user.channelCheckedAt === null) return null
  const ttl = user.channelMember ? MEMBER_TTL_MS : NON_MEMBER_TTL_MS
  return now - user.channelCheckedAt.getTime() < ttl ? user.channelMember : null
}

/**
 * Gerbangnya diloloskan saat keanggotaan tidak bisa dipastikan, dan itu bukan kelalaian:
 * `readChannelMembership` mengembalikan `null` untuk Telegram down, token salah, atau bot
 * yang bukan admin channel — tiga hal yang sama sekali bukan salah user. Menutup gerbang
 * di situ berarti satu gangguan di pihak kami mengunci seluruh basis user sekaligus.
 *
 * `outageUntil` menahan panggilan berikutnya selama gangguan itu berlangsung. Tanpa itu
 * setiap muat sesi dan setiap mulai task menunggu timeout 10 detik yang sudah dipastikan
 * gagal. Umurnya sengaja pendek dan hanya di memori proses: ia meredam badai, bukan
 * menyimpan keputusan.
 */
export async function readChannelGateState(
  user: ChannelGateUser,
  options: { force?: boolean } = {},
): Promise<ChannelGateState> {
  const url = env.telegramChannelUrl
  if (!channelGateRequired()) return { required: false, member: true, url }

  const now = Date.now()
  if (!options.force) {
    const cached = cachedMembership(user, now)
    if (cached !== null) return { required: true, member: cached, url }
    if (now < outageUntil) return { required: true, member: true, url }
  }

  const member = await readChannelMembership(user.telegramId)
  if (member === null) {
    outageUntil = Date.now() + OUTAGE_BACKOFF_MS
    return { required: true, member: true, url }
  }

  outageUntil = 0
  await query('update users set channel_member=$2, channel_checked_at=now() where id=$1', [
    user.id,
    member,
  ])
  return { required: true, member, url }
}

export async function channelGateBlocks(user: ChannelGateUser): Promise<boolean> {
  const state = await readChannelGateState(user)
  return state.required && !state.member
}

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
