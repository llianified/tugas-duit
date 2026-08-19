import type { PoolClient } from 'pg'
import {
  applyEnergyGrant,
  applyEnergySpend,
  projectEnergy,
  type EnergySnapshot,
  type EnergyState,
} from '@/domain/energy'
import { restoreAdPass } from './ads'
import { query } from './db'

export type EnergyView = EnergyState & { now: number }

type EnergyRow = { energy: number; energy_updated_at: Date; now: Date }

const snapshotOf = (row: EnergyRow): EnergySnapshot => ({
  energy: Number(row.energy),
  updatedAt: row.energy_updated_at.getTime(),
})

const ENERGY_SELECT = 'select energy, energy_updated_at, now() as now from users where id=$1'

export async function readEnergy(userId: number, tx?: PoolClient): Promise<EnergyView> {
  const rows = tx
    ? (await tx.query<EnergyRow>(ENERGY_SELECT, [userId])).rows
    : await query<EnergyRow>(ENERGY_SELECT, [userId])
  const row = rows[0]
  if (!row) return emptyView()
  const now = row.now.getTime()
  return { ...projectEnergy(snapshotOf(row), now), now }
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
  const change = applyEnergySpend(snapshotOf(row), now)
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
  const claimed = await tx.query<{ ad_view_id: string | null }>(
    `update challenges set energy_refunded_at=now()
     where id=$1 and user_id=$2 and energy_refunded_at is null
       and (energy_spent_at is not null or ad_view_id is not null)
     returning ad_view_id`,
    [challengeId, userId],
  )
  const row = claimed.rows[0]
  if (!row) return { refunded: false }
  if (row.ad_view_id !== null) return { refunded: await restoreAdPass(tx, userId, row.ad_view_id) }

  return { refunded: (await grantEnergy(tx, userId)).granted }
}

async function grantEnergy(
  tx: PoolClient,
  userId: number,
  amount?: number,
): Promise<{ granted: boolean; state: EnergyView }> {
  const locked = await tx.query<EnergyRow>(`${ENERGY_SELECT} for update`, [userId])
  const row = locked.rows[0]
  if (!row) return { granted: false, state: emptyView() }

  const now = row.now.getTime()
  const change = applyEnergyGrant(snapshotOf(row), now, amount)
  await tx.query('update users set energy=$2, energy_updated_at=$3 where id=$1', [
    userId,
    change.snapshot.energy,
    new Date(change.snapshot.updatedAt),
  ])
  return { granted: true, state: { ...change.state, now } }
}
