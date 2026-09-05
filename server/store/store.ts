import type { PoolClient } from 'pg'
import { applyEnergyGrant, maxEnergy, projectEnergy } from '@/domain/economy/energy'
import { isPremiumActive } from '@/domain/economy/premium'
import {
  isStoreItemKey,
  storeCatalog,
  storeEnabled,
  storeItem,
  storePurchaseRefusal,
  type StoreItem,
  type StoreItemKey,
  type StorePurchaseRefusal,
} from '@/domain/store/store'
import { appendLedger } from '../economy/ledger'
import { readRewardPool } from '../economy/reward-pool'
import { query, transaction } from '../platform/db'
import { grantPremium } from '../premium/premium'

const USER_SELECT = `select balance_credits, energy, energy_updated_at, premium_until, now() as now
  from users where id=$1`

interface UserRow {
  balance_credits: string
  energy: number
  energy_updated_at: Date
  premium_until: Date | null
  now: Date
}

export interface StoreSnapshot {
  enabled: boolean
  items: StoreItem[]
  balance: number
  energy: number
  energyMax: number
  rewardPoolCredits: number
}

export async function readStoreSnapshot(userId: number): Promise<StoreSnapshot> {
  const [rows, pool] = await Promise.all([
    query<UserRow>(USER_SELECT, [userId]),
    readRewardPool(userId),
  ])
  const row = rows[0]
  if (!row) {
    return { enabled: storeEnabled(), items: [], balance: 0, energy: 0, energyMax: maxEnergy(), rewardPoolCredits: 0 }
  }

  const now = row.now.getTime()
  const premium = isPremiumActive(row.premium_until ? row.premium_until.getTime() : null, now)
  const energy = projectEnergy(
    { energy: Number(row.energy), updatedAt: row.energy_updated_at.getTime() },
    now,
    premium,
  )

  return {
    enabled: storeEnabled(),
    items: storeCatalog(),
    balance: Number(row.balance_credits),
    energy: energy.current,
    energyMax: energy.max,
    rewardPoolCredits: pool.current,
  }
}

export type StoreBuyResult =
  | {
      ok: true
      /** `true` kalau tap yang sama sudah pernah dibayar; tidak ada apa pun yang berubah lagi. */
      replayed: boolean
      itemKey: StoreItemKey
      priceCredits: number
      balance: number
    }
  | { ok: false; reason: StorePurchaseRefusal }

/** Belanja dikunci per user. Pemeriksaan saldo, pemotongan, pencatatan pembelian, dan pemberian
 * barangnya jadi satu operasi atomik — termasuk saat tombolnya ditekan dua kali hampir bersamaan.
 *
 * `requestId` datang dari klien dan itu memang syaratnya, sama seperti koreksi admin: belanja tidak
 * punya id alami seperti `task:<challengeId>`. Yang menandai "pembelian yang sama" cuma satu tap
 * yang sama, dan cuma klien yang tahu. */
export async function buyStoreItem(
  userId: number,
  key: string,
  requestId: string,
): Promise<StoreBuyResult> {
  if (!storeEnabled()) return { ok: false, reason: 'store_disabled' }
  if (!isStoreItemKey(key)) return { ok: false, reason: 'unknown_item' }
  const item = storeItem(key)

  return transaction(async (tx) => {
    const locked = await tx.query<UserRow>(`${USER_SELECT} for update`, [userId])
    const row = locked.rows[0]
    if (!row) return { ok: false as const, reason: 'unknown_item' as const }

    /** Dibaca di dalam kunci, sebelum apa pun dipotong. Baris yang sudah ada berarti tap ini sudah
     * pernah dibayar: jawabannya diulang apa adanya, bukan barangnya diberikan lagi. */
    const replay = await tx.query(
      'select 1 from store_purchases where user_id=$1 and request_id=$2 limit 1',
      [userId, requestId],
    )
    if (replay.rows.length > 0) {
      return {
        ok: true as const,
        replayed: true,
        itemKey: item.key,
        priceCredits: item.priceCredits,
        balance: Number(row.balance_credits),
      }
    }

    const now = row.now.getTime()
    const premium = isPremiumActive(row.premium_until ? row.premium_until.getTime() : null, now)
    const snapshot = { energy: Number(row.energy), updatedAt: row.energy_updated_at.getTime() }
    const energy = projectEnergy(snapshot, now, premium)
    const pool = await readRewardPool(userId, tx)

    const refusal = storePurchaseRefusal(item, {
      balance: Number(row.balance_credits),
      energy: energy.current,
      maxEnergy: energy.max,
      rewardPoolCredits: pool.current,
    })
    if (refusal) return { ok: false as const, reason: refusal }

    const ledger = await appendLedger(tx, {
      userId,
      kind: 'purchase',
      amount: -item.priceCredits,
      idempotencyKey: `store:${requestId}`,
      referenceId: item.key,
      note: item.title,
    })

    await applyEffect(tx, userId, item, { snapshot, now, premium })

    await tx.query(
      `insert into store_purchases(user_id, item_key, request_id, price_credits, ledger_id)
       values($1,$2,$3,$4,$5)`,
      [userId, item.key, requestId, item.priceCredits, ledger.ledgerId],
    )

    return {
      ok: true as const,
      replayed: false,
      itemKey: item.key,
      priceCredits: item.priceCredits,
      balance: ledger.balance,
    }
  })
}

async function applyEffect(
  tx: PoolClient,
  userId: number,
  item: StoreItem,
  context: { snapshot: { energy: number; updatedAt: number }; now: number; premium: boolean },
): Promise<void> {
  if (item.effect.kind === 'energy') {
    const granted = applyEnergyGrant(
      context.snapshot,
      context.now,
      context.premium,
      item.effect.amount,
    )
    await tx.query('update users set energy=$2, energy_updated_at=$3 where id=$1', [
      userId,
      granted.snapshot.energy,
      new Date(granted.snapshot.updatedAt),
    ])
    return
  }

  await grantPremium(tx, userId, item.effect.months)
}
