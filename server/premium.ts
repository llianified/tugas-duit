import type { PoolClient } from 'pg'
import { isPremiumActive, premiumDaysLeft, type PremiumMonths } from '@/domain/premium'
import { query } from './db'

export interface PremiumStatus {
  active: boolean
  until: number | null
  daysLeft: number
}

const PREMIUM_SELECT = 'select premium_until, now() as now from users where id=$1'

type PremiumRow = { premium_until: Date | null; now: Date }

const inactive = (): PremiumStatus => ({ active: false, until: null, daysLeft: 0 })

function toStatus(row: PremiumRow | undefined): PremiumStatus {
  if (!row) return inactive()
  const now = row.now.getTime()
  const until = row.premium_until ? row.premium_until.getTime() : null
  return { active: isPremiumActive(until, now), until, daysLeft: premiumDaysLeft(until, now) }
}

export async function readPremium(userId: number, tx?: PoolClient): Promise<PremiumStatus> {
  const rows = tx
    ? (await tx.query<PremiumRow>(PREMIUM_SELECT, [userId])).rows
    : await query<PremiumRow>(PREMIUM_SELECT, [userId])
  return toStatus(rows[0])
}

export async function isPremium(userId: number, tx?: PoolClient): Promise<boolean> {
  return (await readPremium(userId, tx)).active
}

/**
 * Perpanjangan menumpuk dari tanggal berakhir yang masih berlaku, bukan dari sekarang:
 * user yang membeli lagi sebelum langganannya habis tidak kehilangan sisa harinya.
 * `interval '1 month'` dipakai supaya "1 bulan" mengikuti kalender, bukan 30 hari mati.
 */
export async function grantPremium(
  tx: PoolClient,
  userId: number,
  months: PremiumMonths,
): Promise<Date> {
  const granted = await tx.query<{ premium_until: Date }>(
    `update users
        set premium_until = greatest(now(), coalesce(premium_until, now()))
                            + ($2::int * interval '1 month'),
            updated_at = now()
      where id = $1
      returning premium_until`,
    [userId, months],
  )
  const row = granted.rows[0]
  if (!row) throw new Error('User tidak ditemukan')
  return row.premium_until
}
