'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MissionProgress } from '@/domain/missions'
import { fetchJson, sendJson, userFacingMessage } from '@/shell/api-client'
import { hapticTap } from '@/shell/haptic'
import { useToast } from '@/shell/toast'

type ClaimResponse = { energyGranted: number; energy: number; energyMax: number }

/**
 * Misi memuat datanya sendiri, tidak menumpang `/api/session`.
 *
 * Kemajuan misi berubah setiap kali satu task selesai, sementara payload sesi dibaca
 * jauh lebih jarang. Menitipkannya di sana berarti angka misi tertinggal di belakang
 * apa yang baru saja dikerjakan user — bentuk kesalahan yang paling merusak untuk
 * sebuah daftar yang seluruh gunanya adalah menunjukkan progres.
 *
 * Dipisah dari komponennya supaya kartu misi tinggal menggambar: fetch, klaim, haptic,
 * dan toast hidup di sini, dan `MissionCard` hanya menerima state yang sudah jadi.
 */
export function useMissions({
  refreshKey,
  onClaimed,
}: {
  refreshKey: number
  onClaimed: () => Promise<unknown>
}) {
  const [missions, setMissions] = useState<MissionProgress[] | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const showError = useToast()

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ missions: MissionProgress[] }>('/api/missions')
      setMissions(data.missions)
    } catch {
      setMissions([])
    }
  }, [])

  useEffect(() => {
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

  return { missions, claiming, claim }
}
