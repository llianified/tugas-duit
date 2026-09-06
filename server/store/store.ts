import { maxEnergy, projectEnergy } from '@/domain/economy/energy'
import { isPremiumActive } from '@/domain/economy/premium'
import {
  canEquip,
  findStoreItem,
  isStoreItemKey,
  storeCatalog,
  storeCosmeticsEnabled,
  storeEnabled,
  storePrice,
  storePurchaseRefusal,
  type StoreItem,
  type StoreItemKey,
  type StorePurchaseRefusal,
} from '@/domain/store/store'
import {
  cosmetic,
  isCosmeticKey,
  readEquipped,
  NO_COSMETICS,
  type CosmeticKey,
  type EquippedCosmetics,
} from '@/domain/store/cosmetics'
import { appendLedger } from '../economy/ledger'
import { readRewardPool } from '../economy/reward-pool'
import { readWithdrawalGate } from '../payout/payout'
import { readLatestCashOrder, type CashOrder, type CashOrderState } from '../shop/cash-order'
import { query, transaction } from '../platform/db'
import { applyStoreEffect } from './effects'
import { readOwned, readPurchaseState, STORE_USER_SELECT, type StoreUserRow } from './purchase-state'

export interface StoreSnapshot {
  enabled: boolean
  cosmeticsEnabled: boolean
  items: StoreItem[]
  balance: number
  energy: number
  energyMax: number
  rewardPoolCredits: number
  owned: CosmeticKey[]
  equipped: EquippedCosmetics
  /** Sampai kapan Pass Gaspol yang sedang berjalan berlaku. `null` = tidak sedang punya. */
  gaspolUntil: number | null
  /** Dua keadaan yang menentukan Tarik Sekarang layak dijual atau tidak. Dikirim ke klien supaya
   * tombolnya mati dengan keterangan, bukan hidup lalu ditolak sesudah ditekan. */
  withdrawalCooldownActive: boolean
  withdrawalProcessing: boolean
  /** Pesanan QRIS terakhir beserta keadaannya. Yang menggantung membuat lembar toko membuka
   * langsung ke layar pembayaran; yang sudah lunas atau kedaluwarsa yang memberi kalimat penutup
   * yang benar setelah user kembali dari aplikasi banknya. */
  order: (CashOrder & { state: CashOrderState }) | null
}

const empty = (): StoreSnapshot => ({
  enabled: storeEnabled(),
  cosmeticsEnabled: storeCosmeticsEnabled(),
  items: [],
  balance: 0,
  energy: 0,
  energyMax: maxEnergy(),
  rewardPoolCredits: 0,
  owned: [],
  equipped: NO_COSMETICS,
  gaspolUntil: null,
  withdrawalCooldownActive: false,
  withdrawalProcessing: false,
  order: null,
})

export async function readStoreSnapshot(userId: number): Promise<StoreSnapshot> {
  const [rows, pool, owned, gate, order] = await Promise.all([
    query<StoreUserRow>(STORE_USER_SELECT, [userId]),
    readRewardPool(userId),
    readOwned(userId),
    readWithdrawalGate(userId),
    readLatestCashOrder(userId),
  ])
  const row = rows[0]
  if (!row) return empty()

  const now = row.now.getTime()
  const premium = isPremiumActive(row.premium_until ? row.premium_until.getTime() : null, now)
  const energy = projectEnergy(
    { energy: Number(row.energy), updatedAt: row.energy_updated_at.getTime() },
    now,
    premium,
  )
  const gaspolUntil = row.gaspol_until ? row.gaspol_until.getTime() : null

  return {
    enabled: storeEnabled(),
    cosmeticsEnabled: storeCosmeticsEnabled(),
    items: storeCatalog(),
    balance: Number(row.balance_credits),
    energy: energy.current,
    energyMax: energy.max,
    rewardPoolCredits: pool.current,
    owned,
    equipped: readEquipped(row.equipped_frame, row.equipped_title),
    gaspolUntil: gaspolUntil !== null && gaspolUntil > now ? gaspolUntil : null,
    withdrawalCooldownActive: gate.cooldownActive,
    withdrawalProcessing: gate.processing,
    order,
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
  const item = findStoreItem(key)
  if (!item) return { ok: false, reason: 'unknown_item' }
  const price = storePrice(item, 'credits')
  if (price === null) return { ok: false, reason: 'payment_unavailable' }

  return transaction(async (tx) => {
    const locked = await tx.query<StoreUserRow>(`${STORE_USER_SELECT} for update`, [userId])
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
        priceCredits: price,
        balance: Number(row.balance_credits),
      }
    }

    const refusal = storePurchaseRefusal(item, await readPurchaseState(tx, userId, row), 'credits')
    if (refusal) return { ok: false as const, reason: refusal }

    const ledger = await appendLedger(tx, {
      userId,
      kind: 'purchase',
      amount: -price,
      idempotencyKey: `store:${userId}:${requestId}`,
      referenceId: item.key,
      note: item.title,
    })

    await applyStoreEffect(tx, userId, item)

    /** QR yang sedang menggantung untuk barang yang sama dimatikan sekarang juga: membiarkannya
     * hidup berarti user bisa membayar tunai untuk barang yang baru saja ia tebus pakai TD. Sisa
     * balapannya — pembayaran yang mendarat sebelum baris ini commit — tidak bisa ditutup dari
     * sini, dan `settleCashOrder` yang mencatatnya di log supaya bisa dikembalikan tangan. */
    await tx.query(
      `update cash_orders set state='expired', updated_at=now()
        where user_id=$1 and state='pending' and product_key=$2`,
      [userId, item.key],
    )

    await tx.query(
      `insert into store_purchases(user_id, item_key, request_id, price_credits, ledger_id)
       values($1,$2,$3,$4,$5)`,
      [userId, item.key, requestId, price, ledger.ledgerId],
    )

    return {
      ok: true as const,
      replayed: false,
      itemKey: item.key,
      priceCredits: price,
      balance: ledger.balance,
    }
  })
}

export type EquipResult =
  | { ok: true; equipped: EquippedCosmetics }
  | { ok: false; reason: 'not_owned' | 'unknown_slot' }

/** Memasang atau melepas kosmetik. Yang boleh dipasang cuma yang dimiliki — diperiksa di server,
 * bukan cuma di klien, karena bingkai yang dipasang tanpa dibeli akan tampil di papan peringkat
 * untuk semua orang dan itu satu-satunya permukaan publik aplikasi ini. */
export async function equipCosmetic(
  userId: number,
  slot: 'frame' | 'title',
  key: unknown,
): Promise<EquipResult> {
  if (slot !== 'frame' && slot !== 'title') return { ok: false, reason: 'unknown_slot' }
  /** `null` berarti melepas yang sedang dipakai, dan itu selalu boleh. Selain itu key-nya harus ada
   * di katalog DAN jenisnya cocok dengan slotnya — gelar yang dipasang ke slot bingkai lolos
   * kepemilikan tapi tidak akan pernah tergambar. */
  if (key !== null && (!isCosmeticKey(key) || cosmetic(key).kind !== slot)) {
    return { ok: false, reason: 'unknown_slot' }
  }
  const wanted: CosmeticKey | null = key === null ? null : (key as CosmeticKey)

  return transaction(async (tx) => {
    const owned = await readOwned(userId, tx)
    if (!canEquip(wanted, owned)) return { ok: false as const, reason: 'not_owned' as const }

    const column = slot === 'frame' ? 'equipped_frame' : 'equipped_title'
    const rows = await tx.query<{ equipped_frame: string | null; equipped_title: string | null }>(
      `update users set ${column}=$2, updated_at=now() where id=$1
       returning equipped_frame, equipped_title`,
      [userId, wanted],
    )
    const row = rows.rows[0]
    if (!row) return { ok: false as const, reason: 'not_owned' as const }
    return { ok: true as const, equipped: readEquipped(row.equipped_frame, row.equipped_title) }
  })
}
