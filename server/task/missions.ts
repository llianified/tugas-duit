import type { PoolClient } from 'pg'
import {
  buildMissionProgress,
  isMissionAvailable,
  isMissionKey,
  isSocialMissionKey,
  missionDefinition,
  SOCIAL_MISSION_COOLDOWN_MS,
  type MissionCounts,
  type MissionKey,
  type MissionProgress,
  type SocialMissionKey,
} from '@/domain/progression/missions'
import { applyEnergyGrant, maxEnergy, projectEnergy } from '@/domain/economy/energy'
import { isPremiumActive } from '@/domain/economy/premium'
import { query, transaction } from '../platform/db'

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"

/** Penghitung misi otomatis selalu dibaca dari sumber aslinya. Tayangan iklan hanya dihitung setelah `ready_at` terisi, yaitu setelah iklan benar-benar selesai. */
const COUNTS_SQL = `select
    (select count(*) from task_completions
      where user_id=$1 and (completed_at at time zone 'Asia/Jakarta')::date = ${TODAY})::int
      as tasks,
    (select count(*) from task_completions
      where user_id=$1 and stars = 3
        and (completed_at at time zone 'Asia/Jakarta')::date = ${TODAY})::int
      as stars,
    (select count(*) from ad_views
      where user_id=$1 and ready_at is not null
        and (created_at at time zone 'Asia/Jakarta')::date = ${TODAY})::int
      as ads`

/** Follow X dibaca sepanjang umur akun; klaim lainnya hanya milik hari WIB ini. */
const CLAIMED_SQL = `select mission_key from mission_claims
  where user_id=$1
    and (quota_date = ${TODAY} or mission_key = 'twitter_follow')`

const ATTEMPTS_SQL = `select mission_key, started_at from social_mission_attempts
  where user_id=$1 and quota_date = ${TODAY}`

async function readCounts(userId: number, tx?: PoolClient): Promise<MissionCounts> {
  const rows = tx
    ? (await tx.query<MissionCounts>(COUNTS_SQL, [userId])).rows
    : await query<MissionCounts>(COUNTS_SQL, [userId])
  const row = rows[0]
  return {
    tasks: Number(row?.tasks ?? 0),
    stars: Number(row?.stars ?? 0),
    ads: Number(row?.ads ?? 0),
  }
}

async function readClaimed(userId: number, tx?: PoolClient): Promise<MissionKey[]> {
  const rows = tx
    ? (await tx.query<{ mission_key: string }>(CLAIMED_SQL, [userId])).rows
    : await query<{ mission_key: string }>(CLAIMED_SQL, [userId])
  return rows.map((row) => row.mission_key).filter(isMissionKey)
}

async function readActionStarts(
  userId: number,
  tx?: PoolClient,
): Promise<Partial<Record<SocialMissionKey, number>>> {
  const rows = tx
    ? (await tx.query<{ mission_key: string; started_at: Date }>(ATTEMPTS_SQL, [userId])).rows
    : await query<{ mission_key: string; started_at: Date }>(ATTEMPTS_SQL, [userId])
  const starts: Partial<Record<SocialMissionKey, number>> = {}
  for (const row of rows) {
    if (isSocialMissionKey(row.mission_key)) starts[row.mission_key] = row.started_at.getTime()
  }
  return starts
}

export async function readMissions(userId: number): Promise<MissionProgress[]> {
  const [counts, claimed, actionStarts] = await Promise.all([
    readCounts(userId),
    readClaimed(userId),
    readActionStarts(userId),
  ])
  return buildMissionProgress(counts, claimed, actionStarts)
}

async function isAlreadyClaimed(
  tx: PoolClient,
  userId: number,
  key: MissionKey,
): Promise<boolean> {
  const result = await tx.query(
    `select 1 from mission_claims
      where user_id=$1 and mission_key=$2
        and ($2='twitter_follow' or quota_date=${TODAY})
      limit 1`,
    [userId, key],
  )
  return result.rows.length > 0
}

export type MissionActionStartResult =
  | { ok: true; confirmAvailableAt: number }
  | { ok: false; reason: 'unknown_mission' | 'already_claimed' }

/** Menulis cap waktu di server sebelum link sosial dibuka. Upsert-nya sengaja tidak mengubah `started_at`: mengetuk link lagi tidak mereset cooldown yang sudah dilewati. */
export async function startMissionAction(
  userId: number,
  key: string,
): Promise<MissionActionStartResult> {
  if (!isSocialMissionKey(key) || !isMissionAvailable(key)) {
    return { ok: false, reason: 'unknown_mission' }
  }

  return transaction(async (tx) => {
    const locked = await tx.query('select id from users where id=$1 for update', [userId])
    if (locked.rows.length === 0) return { ok: false as const, reason: 'unknown_mission' as const }
    if (await isAlreadyClaimed(tx, userId, key)) {
      return { ok: false as const, reason: 'already_claimed' as const }
    }

    await tx.query(
      `insert into social_mission_attempts(user_id,quota_date,mission_key)
       values($1,${TODAY},$2)
       on conflict(user_id,quota_date,mission_key) do nothing`,
      [userId, key],
    )
    const attempt = await tx.query<{ started_at: Date }>(
      `select started_at from social_mission_attempts
        where user_id=$1 and quota_date=${TODAY} and mission_key=$2`,
      [userId, key],
    )

    return {
      ok: true as const,
      confirmAvailableAt: attempt.rows[0].started_at.getTime() + SOCIAL_MISSION_COOLDOWN_MS,
    }
  })
}

export type MissionClaimResult =
  | { ok: true; energyGranted: number; energy: number; energyMax: number }
  | {
      ok: false
      reason:
        | 'unknown_mission'
        | 'not_done'
        | 'already_claimed'
        | 'energy_full'
        | 'action_required'
        | 'action_cooldown'
    }

/** Klaim dikunci per user. Itu membuat pengecekan, pencatatan klaim, dan pemberian energi menjadi satu operasi atomik, termasuk ketika dua konfirmasi ditekan hampir bersamaan. */
export async function claimMission(userId: number, key: string): Promise<MissionClaimResult> {
  if (!isMissionKey(key) || !isMissionAvailable(key)) {
    return { ok: false, reason: 'unknown_mission' }
  }
  const mission = missionDefinition(key)

  return transaction(async (tx) => {
    const locked = await tx.query<{
      energy: number
      energy_updated_at: Date
      premium_until: Date | null
      now: Date
    }>(
      'select energy, energy_updated_at, premium_until, now() as now from users where id=$1 for update',
      [userId],
    )
    const row = locked.rows[0]
    if (!row) return { ok: false as const, reason: 'unknown_mission' as const }
    if (await isAlreadyClaimed(tx, userId, key)) {
      return { ok: false as const, reason: 'already_claimed' as const }
    }

    if (mission.kind === 'automatic') {
      const counts = await readCounts(userId, tx)
      if (counts[mission.key] < mission.target) {
        return { ok: false as const, reason: 'not_done' as const }
      }
    } else {
      const attempt = await tx.query<{ started_at: Date }>(
        `select started_at from social_mission_attempts
          where user_id=$1 and quota_date=${TODAY} and mission_key=$2`,
        [userId, key],
      )
      const startedAt = attempt.rows[0]?.started_at.getTime()
      if (startedAt === undefined) {
        return { ok: false as const, reason: 'action_required' as const }
      }
      if (row.now.getTime() - startedAt < SOCIAL_MISSION_COOLDOWN_MS) {
        return { ok: false as const, reason: 'action_cooldown' as const }
      }
    }

    const now = row.now.getTime()
    const premium = isPremiumActive(
      row.premium_until ? row.premium_until.getTime() : null,
      now,
    )
    const snapshot = { energy: Number(row.energy), updatedAt: row.energy_updated_at.getTime() }
    const current = projectEnergy(snapshot, now, premium)
    if (current.current + mission.reward > maxEnergy(premium)) {
      return { ok: false as const, reason: 'energy_full' as const }
    }

    await tx.query(
      `insert into mission_claims(user_id,quota_date,mission_key,energy_granted)
       values($1,${TODAY},$2,$3)`,
      [userId, key, mission.reward],
    )

    const granted = applyEnergyGrant(snapshot, now, premium, mission.reward)
    await tx.query('update users set energy=$2, energy_updated_at=$3 where id=$1', [
      userId,
      granted.snapshot.energy,
      new Date(granted.snapshot.updatedAt),
    ])

    return {
      ok: true as const,
      energyGranted: mission.reward,
      energy: granted.state.current,
      energyMax: maxEnergy(premium),
    }
  })
}
