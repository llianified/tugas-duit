import type { PoolClient } from 'pg'
import { projectEnergy } from '@/domain/economy/energy'
import { isPremiumActive } from '@/domain/economy/premium'
import { isCosmeticKey, type CosmeticKey } from '@/domain/store/cosmetics'
import type { StorePurchaseState } from '@/domain/store/store'
import { readRewardPool } from '../economy/reward-pool'
import { readWithdrawalGate } from '../payout/payout'
import { query } from '../platform/db'

/** Potret yang dibaca `storePurchaseRefusal`, dan satu-satunya salinannya.
 *
 * Berdiri di berkas sendiri supaya dua jalur beli bisa memakainya tanpa saling mengimpor:
 * `store/store.ts` (tebus pakai TD) dan `shop/cash-order.ts` (bayar pakai QRIS) sama-sama
 * menanyakan hal ini, sementara yang pertama juga membaca pesanan tunai terakhir dari yang kedua.
 * Ditaruh di salah satu dari keduanya, lingkarannya nyata.
 *
 * Penolakan yang berbeda antara dua jalur beli berarti salah satunya menjual barang yang sudah
 * pasti tidak berguna bagi pembelinya — dan di jalur tunai kerugiannya uang sungguhan. */

export const STORE_USER_SELECT = `select balance_credits, energy, energy_updated_at, premium_until,
    gaspol_until, equipped_frame, equipped_title, now() as now
  from users where id=$1`

export interface StoreUserRow {
  balance_credits: string
  energy: number
  energy_updated_at: Date
  premium_until: Date | null
  gaspol_until: Date | null
  equipped_frame: string | null
  equipped_title: string | null
  now: Date
}

const OWNED_SQL = 'select cosmetic_key from user_cosmetics where user_id=$1'

/** Kosmetik yang dimiliki. Key yang tidak dikenal disaring keluar, bukan diteruskan: baris lama
 * bisa memegang key yang sudah dicabut dari katalog, dan "punya barang yang tidak ada" adalah
 * keadaan yang tidak punya arti di layar mana pun. */
export async function readOwned(userId: number, tx?: PoolClient): Promise<CosmeticKey[]> {
  const rows = tx
    ? (await tx.query<{ cosmetic_key: string }>(OWNED_SQL, [userId])).rows
    : await query<{ cosmetic_key: string }>(OWNED_SQL, [userId])
  return rows.map((row) => row.cosmetic_key).filter(isCosmeticKey)
}

export async function readPurchaseState(
  tx: PoolClient,
  userId: number,
  row: StoreUserRow,
): Promise<StorePurchaseState> {
  const now = row.now.getTime()
  const premium = isPremiumActive(row.premium_until ? row.premium_until.getTime() : null, now)
  const energy = projectEnergy(
    { energy: Number(row.energy), updatedAt: row.energy_updated_at.getTime() },
    now,
    premium,
  )
  const [pool, owned, gate] = await Promise.all([
    readRewardPool(userId, tx),
    readOwned(userId, tx),
    readWithdrawalGate(userId, tx),
  ])

  return {
    balance: Number(row.balance_credits),
    energy: energy.current,
    maxEnergy: energy.max,
    rewardPoolCredits: pool.current,
    ownedCosmetics: owned,
    withdrawalCooldownActive: gate.cooldownActive,
    withdrawalProcessing: gate.processing,
  }
}
