import type { PoolClient } from 'pg'
import {
  buildMissionProgress,
  isMissionKey,
  missionDefinition,
  type MissionCounts,
  type MissionKey,
  type MissionProgress,
} from '@/domain/missions'
import { applyEnergyGrant, maxEnergy, projectEnergy } from '@/domain/energy'
import { isPremiumActive } from '@/domain/premium'
import { query, transaction } from './db'

const TODAY = "(now() at time zone 'Asia/Jakarta')::date"

/**
 * Ketiga penghitung dibaca dari sumber aslinya, bukan dari kolom penghitung sendiri.
 *
 * `ads` menghitung tiket yang `ready_at`-nya terisi — yaitu iklan yang benar-benar
 * selesai ditonton — bukan tiket yang dibuka. Bentuk yang sama dipakai `views_today` di
 * `server/ads.ts`, jadi angka yang dilihat user di kartu misi dan di jatah iklannya
 * tidak akan pernah berselisih.
 */
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

const CLAIMED_SQL = `select mission_key from mission_claims
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

export async function readMissions(userId: number): Promise<MissionProgress[]> {
  const [counts, claimed] = await Promise.all([readCounts(userId), readClaimed(userId)])
  return buildMissionProgress(counts, claimed)
}

export type MissionClaimResult =
  | { ok: true; energyGranted: number; energy: number; energyMax: number }
  | { ok: false; reason: 'unknown_mission' | 'not_done' | 'already_claimed' | 'energy_full' }

const PG_UNIQUE_VIOLATION = '23505'

/**
 * Energi yang diberikan melewati kapasitas akan hangus tanpa jejak — `applyEnergyGrant`
 * memotong di `maxEnergy()`, persis alasan `docs/keputusan-desain.md` menolak energi sebagai
 * hadiah iklan. Di sini kerugian diam-diam itu ditolak lebih dulu: misinya tetap bisa diklaim
 * nanti, dan user diberi tahu kenapa sekarang belum bisa.
 *
 * Yang diperiksa adalah apakah hadiahnya muat SELURUHNYA, bukan sekadar apakah energinya
 * sudah penuh. Penjagaan "penuh" saja meloloskan potongan sebagian: pada 4 dari 5 energi,
 * misi berhadiah 3 hanya menambah 1, sementara klien tetap diberi tahu 3 dan
 * `mission_claims.energy_granted` ikut menyimpan 3 — padahal migrasi `0031` mensyaratkan
 * kolom itu mencatat yang benar-benar diberikan. Klaimnya pun habis untuk hari itu, jadi
 * dua credit energi hilang tanpa ada yang menyebutnya.
 */
export async function claimMission(
  userId: number,
  key: string,
): Promise<MissionClaimResult> {
  if (!isMissionKey(key)) return { ok: false, reason: 'unknown_mission' }
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

    const counts = await readCounts(userId, tx)
    if (counts[key] < mission.target) return { ok: false as const, reason: 'not_done' as const }

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

    try {
      await tx.query(
        `insert into mission_claims(user_id, quota_date, mission_key, energy_granted)
         values($1, ${TODAY}, $2, $3)`,
        [userId, key, mission.reward],
      )
    } catch (error) {
      if ((error as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw error
      return { ok: false as const, reason: 'already_claimed' as const }
    }

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
