'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import type { CosmeticKey, EquippedCosmetics } from '@/domain/store/cosmetics'
import {
  storePrice,
  type StoreItem,
  type StoreItemKey,
  type StorePayment,
} from '@/domain/store/store'
import { clearPurchaseRequestId, purchaseRequestId } from '@/features/store/purchase-key'
import { fetchJson, sendJson, userFacingMessage } from '@/shell/api-client'
import { hapticSuccess, hapticTap } from '@/shared/lib/haptic'
import { useToast } from '@/shell/toast'

export type CashOrderState = 'pending' | 'paid' | 'expired' | 'failed'

export interface StoreOrder {
  orderId: string
  itemKey: StoreItemKey
  itemTitle: string
  amountIdr: number
  totalAmountIdr: number
  qrisUrl: string | null
  expiresAt: number
  state: CashOrderState
}

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
  gaspolUntil: number | null
  withdrawalCooldownActive: boolean
  withdrawalProcessing: boolean
  order: StoreOrder | null
}

interface BuyResponse {
  replayed: boolean
  itemKey: StoreItemKey
  priceCredits: number
  balance: number
}

type CheckoutResponse =
  | { settled: true; itemKey: StoreItemKey }
  | { settled: false; order: Omit<StoreOrder, 'state'> }

/** Belanja, haptic, dan toast hidup di sini supaya lembar toko tinggal menggambar.
 *
 * `requestId` DIPERTAHANKAN per barang sampai pembeliannya benar-benar berhasil, bukan dibuat baru
 * tiap klik. Itu bagian dari idempotensinya: percobaan ulang setelah jaringan putus harus membawa
 * kunci yang SAMA, supaya server mengenalinya sebagai tap yang sudah pernah dibayar alih-alih
 * memotong saldo untuk kedua kalinya. Kunci baru hanya dibuat setelah yang lama selesai.
 *
 * Kuncinya tinggal di `purchase-key.ts`, DI LUAR komponen ini — lembar toko dilepas dari DOM tiap
 * kali ditutup, dan kunci yang ikut hilang bersamanya justru membatalkan janji di paragraf atas.
 *
 * Jalur QRIS tidak butuh kunci seperti itu: yang menjaga pembayaran ganda di sana indeks
 * `cash_orders_one_pending` di database, dan tagihan yang sama dikembalikan apa adanya kalau
 * checkout dipanggil dua kali. */
export function useStore({ onBought }: { onBought: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<StoreItemKey | null>(null)
  const [payment, setPayment] = useState<StorePayment>('credits')
  const [order, setOrder] = useState<StoreOrder | null>(null)
  const showError = useToast()
  const { data, error, mutate } = useSWR<StoreSnapshot>('/api/store', fetchJson<StoreSnapshot>, {
    revalidateOnMount: true,
  })

  const buy = useCallback(
    async (key: StoreItemKey): Promise<boolean> => {
      hapticTap()
      setBusy(key)
      setPayment('credits')

      const requestId = purchaseRequestId(key)

      try {
        await sendJson<BuyResponse>('/api/store/buy', 'POST', { key, requestId })
        clearPurchaseRequestId(key)
        hapticSuccess()
        await Promise.all([mutate(), onBought()])
        return true
      } catch (cause) {
        showError(userFacingMessage(cause))
        await mutate()
        return false
      } finally {
        setBusy(null)
      }
    },
    [mutate, onBought, showError],
  )

  const payWithCash = useCallback(
    async (key: StoreItemKey): Promise<boolean> => {
      hapticTap()
      setBusy(key)
      setPayment('cash')

      try {
        const result = await sendJson<CheckoutResponse>('/api/shop/checkout', 'POST', { key })
        if (result.settled) {
          /** Tagihan lama yang ternyata sudah dibayar diselesaikan di dalam checkout, jadi
           * jawabannya bisa langsung "sudah lunas" tanpa QR baru sama sekali. */
          hapticSuccess()
          await Promise.all([mutate(), onBought()])
          return true
        }
        setOrder({ ...result.order, state: 'pending' })
        return true
      } catch (cause) {
        showError(userFacingMessage(cause))
        await mutate()
        return false
      } finally {
        setBusy(null)
      }
    },
    [mutate, onBought, showError],
  )

  const equip = useCallback(
    async (slot: 'frame' | 'title', key: CosmeticKey | null): Promise<void> => {
      hapticTap()
      try {
        await sendJson<{ equipped: EquippedCosmetics }>('/api/store/equip', 'POST', { slot, key })
        await Promise.all([mutate(), onBought()])
      } catch (cause) {
        showError(userFacingMessage(cause))
        await mutate()
      }
    },
    [mutate, onBought, showError],
  )

  /** Menyegarkan potret lalu mengembalikan nasib tagihan yang sedang dibayar. Dipakai tombol
   * "Sudah bayar" dan polling di layar pembayaran. Layar itu ditutup di sini, bukan di penyaji,
   * supaya penutupannya cuma punya satu sebab. */
  const refreshOrder = useCallback(async (): Promise<StoreOrder | null> => {
    const [next] = await Promise.all([mutate(), onBought()])
    const latest = next?.order ?? null
    /** Yang dicocokkan `orderId`, bukan sekadar "ada pesanan atau tidak": pesanan terbaru bisa
     * saja milik barang lain kalau user membuka dua lembar. Layar pembayaran hanya boleh ditutup
     * oleh nasib tagihan yang sedang ditunggunya sendiri. */
    if (latest && latest.orderId === order?.orderId && latest.state !== 'pending') {
      setOrder(null)
    }
    return latest
  }, [mutate, onBought, order])

  const closeOrder = useCallback(() => setOrder(null), [])

  return {
    store: error ? null : (data ?? null),
    busy,
    payment,
    order,
    buy,
    payWithCash,
    equip,
    refreshOrder,
    closeOrder,
  }
}

/** Alasan sebuah barang belum bisa dibeli lewat cara bayar tertentu, dibaca dari potret yang sudah
 * ada di klien. Ini BUKAN penegakan — yang menolak tetap `storePurchaseRefusal` di server. Gunanya
 * supaya tombolnya mati dengan keterangan, bukan hidup lalu menolak sesudah ditekan.
 *
 * Urutannya sengaja sama dengan yang di server, termasuk yang khusus per barang, supaya keterangan
 * di tombol tidak pernah menyebut alasan yang berbeda dari yang akhirnya menolak. */
export function itemBlocker(
  item: StoreItem,
  store: StoreSnapshot,
  payment: StorePayment,
): string | null {
  const price = storePrice(item, payment)
  if (price === null) return null
  if (payment === 'credits' && store.balance < price) return 'Saldo belum cukup'

  if (item.effect.kind === 'energy') {
    if (store.energy + item.effect.amount > store.energyMax) return 'Energi hampir penuh'
    if (store.rewardPoolCredits <= 0) return 'Stok reward habis'
  }
  if (item.effect.kind === 'gaspol' && store.rewardPoolCredits <= 0) return 'Stok reward habis'
  if (item.effect.kind === 'withdraw_skip') {
    if (store.withdrawalProcessing) return 'Pengajuan lagi diproses'
    if (!store.withdrawalCooldownActive) return 'Lagi nggak kena jeda'
  }
  if (item.effect.kind === 'cosmetic' && store.owned.includes(item.effect.cosmetic)) {
    return 'Udah punya'
  }
  return null
}
