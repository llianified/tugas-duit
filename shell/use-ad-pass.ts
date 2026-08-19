'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

interface AdController {
  show: () => Promise<unknown>
  destroy?: () => void
}

interface AdsgramSdk {
  init: (options: { blockId: string; debug?: boolean }) => AdController
}

type AdsgramWindow = Window & { Adsgram?: AdsgramSdk }

const SDK_WAIT_MS = 8_000
const SDK_POLL_MS = 200

async function waitForSdk(): Promise<AdsgramSdk | null> {
  const deadline = Date.now() + SDK_WAIT_MS
  while (Date.now() < deadline) {
    const sdk = (window as AdsgramWindow).Adsgram
    if (sdk) return sdk
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
  const controller = useRef<{ blockId: string; instance: AdController } | null>(null)

  useEffect(
    () => () => {
      controller.current?.instance.destroy?.()
      controller.current = null
    },
    [],
  )

  const getController = useCallback(async (blockId: string, debug: boolean) => {
    if (controller.current?.blockId === blockId) return controller.current.instance
    const sdk = await waitForSdk()
    if (!sdk) return null
    controller.current?.instance.destroy?.()
    const instance = sdk.init({ blockId, debug })
    controller.current = { blockId, instance }
    return instance
  }, [])

  const hasPass = Boolean(ads?.pass)

  const watchAd = useCallback(async (): Promise<boolean> => {
    if (watchingAd) return false
    if (hasPass) return true
    setWatchingAd(true)
    try {
      const ticket = await sendJson<AdTicketResponse>('/api/ads/ticket', 'POST')
      const instance = await getController(ticket.blockId, ticket.debug)
      if (!instance) {
        notifyError(SDK_MISSING_MESSAGE)
        return false
      }
      try {
        await instance.show()
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
  }, [getController, hasPass, notifyError, refreshSession, watchingAd])

  return { watchAd, watchingAd, hasPass }
}
