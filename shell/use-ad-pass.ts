'use client'

import { useCallback, useState } from 'react'
import { monetagSdkName } from '@/domain/ads'
import { showFailureReason, waitForShow } from '@/shell/monetag-sdk'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

const SHOW_FAILED_MESSAGE = 'Iklannya belum selesai ditonton, jadi tiketnya belum bisa dipakai.'
const SDK_MISSING_MESSAGE = 'Iklannya gagal dimuat. Coba lagi sebentar lagi ya.'

/**
 * `show_<zone>()` bisa reject karena dua hal yang tampak sama di UI tapi beda akarnya:
 * penonton menutup iklan lebih awal (wajar), atau kreatifnya memang tidak pernah termuat
 * (stok kosong / diblokir). Alasan mentahnya diringkas oleh `showFailureReason` lalu
 * ditempelkan ke pesan. Tanpa ini satu-satunya petunjuk yang tersisa cuma "belum selesai
 * ditonton", yang menyesatkan saat penyebabnya iklan gagal muat.
 */
function showFailureMessage(error: unknown): string {
  const reason = showFailureReason(error).trim().slice(0, 80)
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

  /**
   * Rewarded Interstitial memakai pemanggilan SDK tanpa `type: 'inApp'`. Promise hanya
   * dianggap selesai setelah Monetag menyelesaikan tayangan; barulah tiket diklaim.
   */
  const getPlayer = useCallback(async (unitId: string) => {
    const show = await waitForShow(monetagSdkName(unitId))
    if (!show) return null
    return () => show()
  }, [])

  const hasPass = Boolean(ads?.pass)

  const watchAd = useCallback(async (): Promise<boolean> => {
    if (watchingAd) return false
    if (hasPass) return true
    setWatchingAd(true)
    try {
      const ticket = await sendJson<AdTicketResponse>('/api/ads/ticket', 'POST')
      const play = await getPlayer(ticket.unitId)
      if (!play) {
        notifyError(SDK_MISSING_MESSAGE)
        return false
      }
      try {
        await play()
      } catch (error) {
        console.warn('[ads] show_<zone>() reject', error)
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
