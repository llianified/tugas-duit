'use client'

import { useCallback, useState } from 'react'
import { userFacingMessage } from '@/shell/api-client'
import { hapticTap } from '@/shell/haptic'
import { claimChannelBonus, type ChannelBonusState } from '@/shell/session-api'
import { useToast } from '@/shell/toast'

/**
 * Satu tempat yang memutuskan apakah bonus ini masih ada.
 *
 * Sebelumnya syaratnya ditulis dua kali: kartunya menjaga dirinya sendiri dengan
 * `!bonus.enabled || bonus.claimed`, dan `HomeView` menghitung ulang kebalikannya untuk
 * tahu apakah perlu memberi jarak ke kartu di bawahnya. Dua salinan aturan yang sama di
 * dua lapisan berbeda berarti mematikan bonus lewat konfigurasi bisa menyisakan jarak
 * kosong di Beranda — kartunya hilang, `region-gap-t` di atasnya tidak.
 *
 * Sebagai type predicate, hasilnya sekaligus menyempitkan `ChannelBonusState | null`
 * menjadi non-null, jadi pemanggilnya tidak perlu mengecek dua kali.
 */
export function channelBonusReachable(
  bonus: ChannelBonusState | null,
): bonus is ChannelBonusState {
  return bonus !== null && bonus.enabled && !bonus.claimed
}

/**
 * Klaim bonus channel: haptic, panggil API, segarkan sesi, dan tampilkan galat.
 *
 * Dipisah dari komponennya mengikuti `useMissions` — kartunya tinggal menggambar, dan
 * satu-satunya aksi di dalamnya tidak lagi membawa `useState`, `try/finally`, serta
 * `useToast` sendiri. `hapticTap()` ikut ke sini supaya tombol klaim terasa sama dengan
 * tombol klaim misi, yang sejak awal punya getaran itu sementara tombol ini tidak.
 */
export function useChannelBonus({ onClaimed }: { onClaimed: () => Promise<unknown> }) {
  const [claiming, setClaiming] = useState(false)
  const showError = useToast()

  const claim = useCallback(async () => {
    hapticTap()
    setClaiming(true)
    try {
      await claimChannelBonus()
      await onClaimed()
    } catch (cause) {
      showError(userFacingMessage(cause))
    } finally {
      setClaiming(false)
    }
  }, [onClaimed, showError])

  return { claiming, claim }
}
