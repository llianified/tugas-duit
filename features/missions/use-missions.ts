'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import { fetchMissions, MISSIONS_KEY, type TimedMissionsResponse } from '@/shell/session-api'
import { hapticSuccess, hapticTap } from '@/shared/lib/haptic'
import { useToast } from '@/shell/toast'

type ClaimResponse = { energyGranted: number; energy: number; energyMax: number }
type ActionStartResponse = { confirmAt: number; serverNow: number }

export interface MissionClockAnchor {
  serverNow: number
  receivedAt: number
}

export interface MissionActionTiming extends MissionClockAnchor {
  confirmAt: number
}

/** Misi tetap punya endpoint sendiri, tetapi datanya berbagi cache SWR dengan shell supaya kartu dan indikator nav selalu membaca potret yang sama. Dipisah dari komponennya supaya kartu misi tinggal menggambar: refresh, klaim, haptic, dan toast hidup di sini, dan `MissionCard` hanya menerima state yang sudah jadi. */
export function useMissions({
  refreshKey,
  onClaimed,
  onGranted,
}: {
  refreshKey: number
  onClaimed: () => Promise<unknown>
  /** Dipanggil begitu server MENGKONFIRMASI hadiahnya, sebelum daftar dan sesi disegarkan.
   * Perayaan tidak boleh menunggu dua permintaan jaringan yang tidak menambah apa pun padanya:
   * hadiahnya sudah pasti sejak POST-nya balik, dan bingkisan yang baru terbuka sedetik setelah
   * tombolnya ditekan terbaca sebagai aplikasi yang tersendat, bukan sebagai perayaan. */
  onGranted?: (energyGranted: number) => void
}) {
  const [claiming, setClaiming] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const previousRefreshKey = useRef(refreshKey)
  const showError = useToast()
  const { data, error, mutate } = useSWR<TimedMissionsResponse>(MISSIONS_KEY, fetchMissions, {
    revalidateOnMount: true,
  })

  const load = useCallback(async () => {
    try {
      await mutate()
    } catch {
      // SWR menyimpan error-nya; daftar memakai fallback kosong seperti perilaku sebelumnya.
    }
  }, [mutate])

  useEffect(() => {
    if (previousRefreshKey.current === refreshKey) return
    previousRefreshKey.current = refreshKey
    void load()
  }, [load, refreshKey])

  const startAction = useCallback(
    async (key: string): Promise<MissionActionTiming | null> => {
      hapticTap()
      setStarting(key)
      try {
        const result = await sendJson<ActionStartResponse>('/api/missions/start', 'POST', { key })
        const timing = { ...result, receivedAt: Date.now() }
        await load()
        return timing
      } catch (cause) {
        showError(userFacingMessage(cause))
        await load()
        return null
      } finally {
        setStarting(null)
      }
    },
    [load, showError],
  )

  /** Nominal yang dipakai perayaan datang dari `energyGranted` milik server, bukan dari
   * `mission.reward` di klien: keduanya bisa berbeda, dan yang benar cuma yang dicatat server.
   * `onGranted` dipanggil di sini — tepat setelah POST-nya balik — bukan dari nilai balik fungsi
   * ini, karena fungsi ini baru selesai setelah daftar dan sesi ikut disegarkan. */
  const claim = useCallback(
    async (key: string): Promise<boolean> => {
      hapticTap()
      setClaiming(key)
      try {
        const result = await sendJson<ClaimResponse>('/api/missions/claim', 'POST', { key })
        hapticSuccess()
        onGranted?.(result.energyGranted)
        await Promise.all([load(), onClaimed()])
        return true
      } catch (cause) {
        showError(userFacingMessage(cause))
        await load()
        return false
      } finally {
        setClaiming(null)
      }
    },
    [load, onClaimed, onGranted, showError],
  )

  return {
    missions: error ? [] : (data?.missions ?? null),
    clock: data ? { serverNow: data.serverNow, receivedAt: data.receivedAt } : null,
    claiming,
    starting,
    startAction,
    claim,
  }
}
