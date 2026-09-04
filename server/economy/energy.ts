import type { PoolClient } from 'pg'
import {
  applyEnergyGrant,
  applyEnergySpend,
  projectEnergy,
  type EnergySnapshot,
  type EnergyState,
} from '@/domain/economy/energy'
import { isPremiumActive } from '@/domain/economy/premium'
import { restoreAdPass } from '../ads/ads'
import { query } from '../platform/db'

export type EnergyView = EnergyState & { now: number }

type EnergyRow = {
  energy: number
  energy_updated_at: Date
  premium_until: Date | null
  now: Date
}

const snapshotOf = (row: EnergyRow): EnergySnapshot => ({
  energy: Number(row.energy),
  updatedAt: row.energy_updated_at.getTime(),
})

const premiumOf = (row: EnergyRow): boolean =>
  isPremiumActive(row.premium_until ? row.premium_until.getTime() : null, row.now.getTime())

const ENERGY_SELECT =
  'select energy, energy_updated_at, premium_until, now() as now from users where id=$1'

export async function readEnergy(userId: number, tx?: PoolClient): Promise<EnergyView> {
  const rows = tx
    ? (await tx.query<EnergyRow>(ENERGY_SELECT, [userId])).rows
    : await query<EnergyRow>(ENERGY_SELECT, [userId])
  const row = rows[0]
  if (!row) return emptyView()
  const now = row.now.getTime()
  return { ...projectEnergy(snapshotOf(row), now, premiumOf(row)), now }
}

function emptyView(): EnergyView {
  const now = Date.now()
  return { ...projectEnergy({ energy: 0, updatedAt: now }, now), now }
}

export async function spendEnergy(
  tx: PoolClient,
  userId: number,
): Promise<{ ok: boolean; state: EnergyView }> {
  const locked = await tx.query<EnergyRow>(`${ENERGY_SELECT} for update`, [userId])
  const row = locked.rows[0]
  if (!row) return { ok: false, state: emptyView() }

  const now = row.now.getTime()
  const change = applyEnergySpend(snapshotOf(row), now, premiumOf(row))
  if (!change.ok) return { ok: false, state: { ...change.state, now } }

  await tx.query('update users set energy=$2, energy_updated_at=$3 where id=$1', [
    userId,
    change.snapshot.energy,
    new Date(change.snapshot.updatedAt),
  ])
  return { ok: true, state: { ...change.state, now } }
}

export async function refundEntry(
  tx: PoolClient,
  userId: number,
  challengeId: string,
): Promise<{ refunded: boolean }> {
  const owed = await tx.query<{ ad_view_id: string | null }>(
    `select ad_view_id from challenges
     where id=$1 and user_id=$2 and energy_refunded_at is null
       and (energy_spent_at is not null or ad_view_id is not null)
     for update`,
    [challengeId, userId],
  )
  const row = owed.rows[0]
  if (!row) return { refunded: false }
  if (row.ad_view_id !== null && !(await restoreAdPass(tx, userId, row.ad_view_id))) {
    return { refunded: false }
  }

  const claimed = await tx.query(
    'update challenges set energy_refunded_at=now() where id=$1 and energy_refunded_at is null',
    [challengeId],
  )
  if (claimed.rowCount === 0) return { refunded: false }
  if (row.ad_view_id !== null) return { refunded: true }

  return { refunded: (await grantEnergy(tx, userId)).granted }
}

/** Diekspor untuk panel admin: mengisi energi user tanpa menyentuh saldo maupun kolam. Tetap lewat `applyEnergyGrant` supaya `users_energy_range` dan jangkar regen dihormati sama persis seperti pengembalian ongkos masuk. */
export async function grantEnergy(
  tx: PoolClient,
  userId: number,
  amount?: number,
): Promise<{ granted: boolean; state: EnergyView }> {
  const locked = await tx.query<EnergyRow>(`${ENERGY_SELECT} for update`, [userId])
  const row = locked.rows[0]
  if (!row) return { granted: false, state: emptyView() }

  const now = row.now.getTime()
  const change = applyEnergyGrant(snapshotOf(row), now, premiumOf(row), amount)
  await tx.query('update users set energy=$2, energy_updated_at=$3 where id=$1', [
    userId,
    change.snapshot.energy,
    new Date(change.snapshot.updatedAt),
  ])
  return { granted: true, state: { ...change.state, now } }
}
