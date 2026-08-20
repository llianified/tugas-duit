'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdProvider } from '@/domain/ads'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

interface AdController {
  show: () => Promise<unknown>
  destroy?: () => void
}

interface AdsgramSdk {
  init: (options: { blockId: string; debug?: boolean }) => AdController
}

/**
 * Dua SDK dengan bentuk yang berbeda jauh. GigaPub hanya menempel satu fungsi global
 * `showGiga()` — tidak ada `init`, tidak ada instance yang perlu di-cache atau
 * di-`destroy`, dan unit iklannya sudah menempel di URL script (lihat `app/layout.tsx`).
 * Adsgram sebaliknya: `init({ blockId })` mengembalikan controller yang harus dipakai
 * ulang, karena `init` berulang untuk blockId yang sama membocorkan instance.
 */
type AdWindow = Window & {
  showGiga?: (params?: unknown) => Promise<unknown>
  Adsgram?: AdsgramSdk
}

const SDK_WAIT_MS = 8_000
const SDK_POLL_MS = 200

async function waitFor<T>(read: () => T | undefined): Promise<T | null> {
  const deadline = Date.now() + SDK_WAIT_MS
  while (Date.now() < deadline) {
    const value = read()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, SDK_POLL_MS))
  }
  return null
}

const SHOW_FAILED_MESSAGE = 'Iklannya belum selesai ditonton, jadi tiketnya belum bisa dipakai.'
const SDK_MISSING_MESSAGE = 'Iklannya gagal dimuat. Coba lagi sebentar lagi ya.'

export function useAdPass({
  ads,
  notifyError,
  refreshSession,
}: {
  ads: AdsState | null
  notifyError: (message: string) => void
  refreshSession: () => Promise<unknown>
}) {
  const [watchingAd, setWatchingAd] = useState(false)
  const adsgram = useRef<{ blockId: string; instance: AdController } | null>(null)

  useEffect(
    () => () => {
      adsgram.current?.instance.destroy?.()
      adsgram.current = null
    },
    [],
  )

  /**
   * Mengembalikan fungsi tayang, bukan controller: cuma Adsgram yang punya controller,
   * jadi bentuk bersama yang paling jujur adalah "sesuatu yang bisa dipanggil".
   */
  const getPlayer = useCallback(
    async (provider: AdProvider, unitId: string, debug: boolean) => {
      if (provider === 'gigapub') {
        const showGiga = await waitFor(() => (window as AdWindow).showGiga)
        if (!showGiga) return null
        return () => showGiga()
      }

      if (adsgram.current?.blockId === unitId) {
        const cached = adsgram.current.instance
        return () => cached.show()
      }
      const sdk = await waitFor(() => (window as AdWindow).Adsgram)
      if (!sdk) return null
      adsgram.current?.instance.destroy?.()
      const instance = sdk.init({ blockId: unitId, debug })
      adsgram.current = { blockId: unitId, instance }
      return () => instance.show()
    },
    [],
  )

  const hasPass = Boolean(ads?.pass)

  const watchAd = useCallback(async (): Promise<boolean> => {
    if (watchingAd) return false
    if (hasPass) return true
    setWatchingAd(true)
    try {
      const ticket = await sendJson<AdTicketResponse>('/api/ads/ticket', 'POST')
      const play = await getPlayer(ticket.provider, ticket.unitId, ticket.debug)
      if (!play) {
        notifyError(SDK_MISSING_MESSAGE)
        return false
      }
      try {
        await play()
      } catch {
        notifyError(SHOW_FAILED_MESSAGE)
        return false
      }
      await sendJson<AdClaimResponse>('/api/ads/claim', 'POST', { ticketId: ticket.ticketId })
      return true
    } catch (error) {
      notifyError(userFacingMessage(error))
      return false
    } finally {
      setWatchingAd(false)
      await refreshSession()
    }
  }, [getPlayer, hasPass, notifyError, refreshSession, watchingAd])

  return { watchAd, watchingAd, hasPass }
}
