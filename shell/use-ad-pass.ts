'use client'

import { useCallback, useState } from 'react'
import type { AdProvider } from '@/domain/ads/ads'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import { gigaPubFailureReason, waitForGigaPubShow } from '@/shell/gigapub-sdk'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

const SHOW_FAILED_MESSAGE = 'Iklannya belum selesai. Tiket belum masuk.'
const SDK_MISSING_MESSAGE = 'Iklan gagal dimuat. Coba lagi nanti.'

/** `showGiga()` dapat ditolak saat penonton menutup iklan atau kreatif gagal dimuat. Ringkas alasan tanpa membocorkan objek mentah ke UI. */
function showFailureMessage(error: unknown): string {
  const reason = gigaPubFailureReason(error).trim().slice(0, 80)
  return reason ? `${SHOW_FAILED_MESSAGE} (${reason})` : SHOW_FAILED_MESSAGE
}

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

  /** Promise Giga.pub hanya resolve setelah rewarded ad selesai; tiket baru boleh diklaim sesudah itu. Monetag sengaja tidak menjadi fallback karena hanya dipakai untuk in-app. */
  const getPlayer = useCallback(async (provider: AdProvider) => {
    if (provider !== 'gigapub') return null
    return waitForGigaPubShow()
  }, [])

  const hasPass = Boolean(ads?.pass)

  const watchAd = useCallback(async (): Promise<boolean> => {
    if (watchingAd) return false
    if (hasPass) return true
    setWatchingAd(true)
    try {
      const ticket = await sendJson<AdTicketResponse>('/api/ads/ticket', 'POST')
      const play = await getPlayer(ticket.provider)
      if (!play) {
        notifyError(SDK_MISSING_MESSAGE)
        return false
      }
      try {
        await play()
      } catch (error) {
        console.warn('[ads] showGiga() reject', error)
        notifyError(showFailureMessage(error))
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
