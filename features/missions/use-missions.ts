'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { fetchJson, sendJson, userFacingMessage } from '@/shell/api-client'
import type { MissionsResponse } from '@/shell/session-api'
import { hapticSuccess, hapticTap } from '@/shared/lib/haptic'
import { useToast } from '@/shell/toast'

type ClaimResponse = { energyGranted: number; energy: number; energyMax: number }
type ActionStartResponse = { confirmAvailableAt: number }

/** Misi tetap punya endpoint sendiri, tetapi datanya berbagi cache SWR dengan shell supaya kartu dan indikator nav selalu membaca potret yang sama. Dipisah dari komponennya supaya kartu misi tinggal menggambar: refresh, klaim, haptic, dan toast hidup di sini, dan `MissionCard` hanya menerima state yang sudah jadi. */
export function useMissions({
  refreshKey,
  onClaimed,
}: {
  refreshKey: number
  onClaimed: () => Promise<unknown>
}) {
  const [claiming, setClaiming] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
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

  const startAction = useCallback(
    async (key: string): Promise<number | null> => {
      hapticTap()
      setStarting(key)
      try {
        const result = await sendJson<ActionStartResponse>('/api/missions/start', 'POST', { key })
        await load()
        return result.confirmAvailableAt
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

  const claim = useCallback(
    async (key: string): Promise<boolean> => {
      hapticTap()
      setClaiming(key)
      try {
        await sendJson<ClaimResponse>('/api/missions/claim', 'POST', { key })
        hapticSuccess()
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
    [load, onClaimed, showError],
  )

  return {
    missions: error ? [] : (data?.missions ?? null),
    claiming,
    starting,
    startAction,
    claim,
  }
}
