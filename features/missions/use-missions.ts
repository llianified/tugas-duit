'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { fetchJson, sendJson, userFacingMessage } from '@/shell/api-client'
import type { MissionsResponse } from '@/shell/session-api'
import { hapticTap } from '@/shared/lib/haptic'
import { useToast } from '@/shell/toast'

type ClaimResponse = { energyGranted: number; energy: number; energyMax: number }

/** Misi tetap punya endpoint sendiri, tetapi datanya berbagi cache SWR dengan shell supaya kartu dan indikator nav selalu membaca potret yang sama. Dipisah dari komponennya supaya kartu misi tinggal menggambar: refresh, klaim, haptic, dan toast hidup di sini, dan `MissionCard` hanya menerima state yang sudah jadi. */
export function useMissions({
  refreshKey,
  onClaimed,
}: {
  refreshKey: number
  onClaimed: () => Promise<unknown>
}) {
  const [claiming, setClaiming] = useState<string | null>(null)
  const previousRefreshKey = useRef(refreshKey)
  const showError = useToast()
  const { data, error, mutate } = useSWR<MissionsResponse>('/api/missions', fetchJson, {
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

  const claim = useCallback(
    async (key: string) => {
      hapticTap()
      setClaiming(key)
      try {
        await sendJson<ClaimResponse>('/api/missions/claim', 'POST', { key })
        await Promise.all([load(), onClaimed()])
      } catch (cause) {
        showError(userFacingMessage(cause))
        await load()
      } finally {
        setClaiming(null)
      }
    },
    [load, onClaimed, showError],
  )

  return {
    missions: error ? [] : (data?.missions ?? null),
    claiming,
    claim,
  }
}
