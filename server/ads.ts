import type { PoolClient } from 'pg'
import {
  adClaimTooFast,
  adCooldownSecondsLeft,
  adOpenRefusal,
  adViewsLeft,
  adsConfigured,
  type AdProvider,
  type AdRefusal,
} from '@/domain/ads'
import { economyConfig } from '@/domain/economy-config'
import { resolveAdProvider } from './ad-provider'
import { query, transaction } from './db'
import { recordAdClaimSignal } from './fraud'

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PG_UNIQUE_VIOLATION = '23505'

const STATE_SQL = `select
    count(*) filter (
      where (created_at at time zone 'Asia/Jakarta')::date = ${TODAY} and ready_at is not null
    )::int as views_today,
    max(created_at) filter (where ready_at is not null) as last_opened_at,
    count(*) filter (where state='pending')::int as pending_count,
    count(*) filter (where state='ready')::int as ready_count,
    max(expires_at) filter (where state='ready') as pass_expires_at,
    (select count(*) from challenges c
      where c.user_id=$1 and c.submitted_at is null and c.ad_view_id is not null)::int
      as entry_open_count,
    now() as now
  from ad_views where user_id=$1`

type StateRow = {
  views_today: number
  last_opened_at: Date | null
  pending_count: number
  ready_count: number
  pass_expires_at: Date | null
  entry_open_count: number
  now: Date
}

const EXPIRE_STALE_SQL = `update ad_views set state='expired'
  where user_id=$1 and state in ('pending','ready') and expires_at <= now()`

async function run<T>(sql: string, params: unknown[], tx?: PoolClient): Promise<T[]> {
  return tx ? ((await tx.query(sql, params)).rows as T[]) : query<T>(sql, params)
}

async function readState(userId: number, tx?: PoolClient) {
  await run(EXPIRE_STALE_SQL, [userId], tx)
  const rows = await run<StateRow>(STATE_SQL, [userId], tx)
  const row = rows[0]
  const now = row ? row.now.getTime() : Date.now()
  return {
    now,
    viewsToday: row ? Number(row.views_today) : 0,
    lastOpenedAt: row?.last_opened_at ? row.last_opened_at.getTime() : null,
    hasPending: Boolean(row && Number(row.pending_count) > 0),
    hasReady: Boolean(row && Number(row.ready_count) > 0),
    hasEntryOpen: Boolean(row && Number(row.entry_open_count) > 0),
    passExpiresAt: row?.pass_expires_at ? row.pass_expires_at.getTime() : null,
  }
}

export interface AdsSessionState {
  enabled: boolean
  provider: AdProvider | null
  unitId: string | null
  viewsLeft: number
  cooldownSecondsLeft: number
  pass: { expiresAt: number } | null
}

export async function readAdsState(userId: number): Promise<AdsSessionState> {
  const resolved = resolveAdProvider()
  const enabled = Boolean(resolved) && adsConfigured()
  if (!resolved || !enabled) {
    return {
      enabled: false,
      provider: null,
      unitId: null,
      viewsLeft: 0,
      cooldownSecondsLeft: 0,
      pass: null,
    }
  }
  const state = await readState(userId)
  return {
    enabled: true,
    provider: resolved.provider,
    unitId: resolved.unitId,
    viewsLeft: adViewsLeft(state.viewsToday),
    cooldownSecondsLeft: adCooldownSecondsLeft(state.lastOpenedAt, state.now),
    pass: state.hasReady && state.passExpiresAt !== null ? { expiresAt: state.passExpiresAt } : null,
  }
}

export type OpenTicketResult =
  | {
      ok: true
      ticketId: string
      provider: AdProvider
      unitId: string
      expiresAt: number
    }
  | { ok: false; reason: AdRefusal; cooldownSecondsLeft: number; viewsLeft: number }

export async function openAdTicket(userId: number): Promise<OpenTicketResult> {
  const resolved = resolveAdProvider()
  if (!resolved)
    return { ok: false, reason: 'ads_disabled', cooldownSecondsLeft: 0, viewsLeft: 0 }
  const { provider, unitId } = resolved

  return transaction(async (tx) => {
    const state = await readState(userId, tx)
    const refusal = adOpenRefusal(state, state.now)
    if (refusal && refusal !== 'ticket_open')
      return {
        ok: false as const,
        reason: refusal,
        cooldownSecondsLeft: adCooldownSecondsLeft(state.lastOpenedAt, state.now),
        viewsLeft: adViewsLeft(state.viewsToday),
      }

    if (refusal === 'ticket_open') {
      const open = await tx.query<{ id: string; expires_at: Date }>(
        "select id, expires_at from ad_views where user_id=$1 and state='pending' limit 1",
        [userId],
      )
      const pending = open.rows[0]
      if (pending)
        return {
          ok: true as const,
          ticketId: pending.id,
          provider,
          unitId,
          expiresAt: pending.expires_at.getTime(),
        }
    }

    try {
      const inserted = await tx.query<{ id: string; expires_at: Date }>(
        `insert into ad_views(user_id,block_id,expires_at)
         values($1,$2,now()+($3::int * interval '1 second'))
         returning id, expires_at`,
        [userId, unitId, economyConfig().adsTicketTtlSeconds],
      )
      const row = inserted.rows[0]
      return {
        ok: true as const,
        ticketId: row.id,
        provider,
        unitId,
        expiresAt: row.expires_at.getTime(),
      }
    } catch (error) {
      if ((error as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw error
      return {
        ok: false as const,
        reason: 'ticket_open' as const,
        cooldownSecondsLeft: adCooldownSecondsLeft(state.lastOpenedAt, state.now),
        viewsLeft: adViewsLeft(state.viewsToday),
      }
    }
  })
}

export type ClaimTicketResult =
  | { ok: true; pass: { expiresAt: number } }
  | { ok: false; reason: 'no_ticket' | 'ticket_expired' | 'pass_ready' }

const CLAIM_BURST_WINDOW_MINUTES = 10
const CLAIM_BURST_THRESHOLD = 5

export async function claimAdTicket(userId: number, ticketId: string): Promise<ClaimTicketResult> {
  if (!ticketId || !UUID_PATTERN.test(ticketId)) {
    await transaction((tx) =>
      recordAdClaimSignal(tx, userId, 'ad_claim_without_ticket', { ticketId: null }),
    )
    return { ok: false, reason: 'no_ticket' }
  }

  return transaction(async (tx) => {
    const locked = await tx.query<{ state: string; created_at: Date; expires_at: Date; now: Date }>(
      'select state, created_at, expires_at, now() as now from ad_views where id=$1 and user_id=$2 for update',
      [ticketId, userId],
    )
    const row = locked.rows[0]
    if (!row || row.state !== 'pending') {
      await recordAdClaimSignal(tx, userId, 'ad_claim_without_ticket', {
        ticketId,
        state: row?.state ?? null,
      })
      return { ok: false as const, reason: 'no_ticket' as const }
    }

    const now = row.now.getTime()
    if (row.expires_at.getTime() <= now) {
      await tx.query('update ad_views set state=$2 where id=$1', [ticketId, 'expired'])
      return { ok: false as const, reason: 'ticket_expired' as const }
    }
    if (adClaimTooFast(row.created_at.getTime(), now)) {
      await recordAdClaimSignal(tx, userId, 'ad_claim_too_fast', {
        ticketId,
        watchedMs: now - row.created_at.getTime(),
      })
    }

    const burst = await tx.query<{ recent: number }>(
      `select count(*)::int as recent from ad_views
        where user_id=$1 and ready_at > now() - ($2::int * interval '1 minute')`,
      [userId, CLAIM_BURST_WINDOW_MINUTES],
    )
    if (Number(burst.rows[0].recent) >= CLAIM_BURST_THRESHOLD) {
      await recordAdClaimSignal(tx, userId, 'ad_claim_burst', {
        klaim: Number(burst.rows[0].recent),
        windowMinutes: CLAIM_BURST_WINDOW_MINUTES,
      })
    }

    try {
      const claimed = await tx.query<{ expires_at: Date }>(
        `update ad_views
           set state='ready', ready_at=now(), expires_at=now()+($3::int * interval '1 minute')
         where id=$1 and user_id=$2 and state='pending'
         returning expires_at`,
        [ticketId, userId, economyConfig().adsPassTtlMinutes],
      )
      const updated = claimed.rows[0]
      if (!updated) return { ok: false as const, reason: 'no_ticket' as const }
      return { ok: true as const, pass: { expiresAt: updated.expires_at.getTime() } }
    } catch (error) {
      if ((error as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw error
      return { ok: false as const, reason: 'pass_ready' as const }
    }
  })
}

export async function consumeAdPass(
  tx: PoolClient,
  userId: number,
): Promise<{ id: string } | null> {
  const consumed = await tx.query<{ id: string }>(
    `update ad_views set state='consumed', consumed_at=now()
      where user_id=$1 and state='ready' and expires_at>now()
      returning id`,
    [userId],
  )
  return consumed.rows[0] ?? null
}

export async function restoreAdPass(
  tx: PoolClient,
  userId: number,
  adViewId: string,
): Promise<boolean> {
  const restored = await tx.query<{ id: string }>(
    `update ad_views
        set state='ready', consumed_at=null,
            expires_at=ready_at+($3::int * interval '1 minute')
      where id=$1 and user_id=$2 and state='consumed'
        and ready_at+($3::int * interval '1 minute') > now()
        and not exists (
          select 1 from ad_views other
           where other.user_id=$2 and other.state='ready'
        )
      returning id`,
    [adViewId, userId, economyConfig().adsPassTtlMinutes],
  )
  return restored.rowCount !== 0
}
