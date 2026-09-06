'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import type { StoreItem, StoreItemKey } from '@/domain/store/store'
import { clearPurchaseRequestId, purchaseRequestId } from '@/features/store/purchase-key'
import { fetchJson, sendJson, userFacingMessage } from '@/shell/api-client'
import { hapticSuccess, hapticTap } from '@/shared/lib/haptic'
import { useToast } from '@/shell/toast'

export interface StoreSnapshot {
  enabled: boolean
  items: StoreItem[]
  balance: number
  energy: number
  energyMax: number
  rewardPoolCredits: number
}

interface BuyResponse {
  replayed: boolean
  itemKey: StoreItemKey
  priceCredits: number
  balance: number
}

/** Belanja, haptic, dan toast hidup di sini supaya lembar toko tinggal menggambar.
 *
 * `requestId` DIPERTAHANKAN per barang sampai pembeliannya benar-benar berhasil, bukan dibuat baru
 * tiap klik. Itu bagian dari idempotensinya: percobaan ulang setelah jaringan putus harus membawa
 * kunci yang SAMA, supaya server mengenalinya sebagai tap yang sudah pernah dibayar alih-alih
 * memotong saldo untuk kedua kalinya. Kunci baru hanya dibuat setelah yang lama selesai.
 *
 * Kuncinya tinggal di `purchase-key.ts`, DI LUAR komponen ini — lembar toko dilepas dari DOM tiap
 * kali ditutup, dan kunci yang ikut hilang bersamanya justru membatalkan janji di paragraf atas. */
export function useStore({ onBought }: { onBought: () => Promise<unknown> }) {
  const [buying, setBuying] = useState<StoreItemKey | null>(null)
  const showError = useToast()
  const { data, error, mutate } = useSWR<StoreSnapshot>('/api/store', fetchJson<StoreSnapshot>, {
    revalidateOnMount: true,
  })

  const buy = useCallback(
    async (key: StoreItemKey): Promise<boolean> => {
      hapticTap()
      setBuying(key)

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
        setBuying(null)
      }
    },
    [mutate, onBought, showError],
  )

  return { store: error ? null : (data ?? null), buying, buy }
}

/** Alasan sebuah barang belum bisa dibeli, dibaca dari potret yang sudah ada di klien. Ini BUKAN
 * penegakan — yang menolak tetap `storePurchaseRefusal` di server. Gunanya supaya tombolnya mati
 * dengan keterangan, bukan hidup lalu menolak sesudah ditekan. */
export function itemBlocker(item: StoreItem, store: StoreSnapshot): string | null {
  if (store.balance < item.priceCredits) return 'Saldo belum cukup'
  if (item.effect.kind === 'energy') {
    if (store.energy + item.effect.amount > store.energyMax) return 'Energi hampir penuh'
    if (store.rewardPoolCredits <= 0) return 'Stok reward habis'
  }
  return null
}
