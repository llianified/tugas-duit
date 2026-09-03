'use client'

import { useCallback, useState } from 'react'
import type { AdProvider } from '@/domain/ads/ads'
import { watchAdToFinish } from '@/shell/ad-watch'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import { waitForGigaPubShow } from '@/shell/gigapub-sdk'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

const SHOW_FAILED_MESSAGE = 'Iklannya belum selesai. Tiket belum masuk.'
const SDK_MISSING_MESSAGE = 'Iklan gagal dimuat. Coba lagi nanti.'
/** Ditinggal ke halaman pengiklan lalu back: jatah harian dan cooldown belum terpakai, jadi ajakannya mencoba lagi — bukan sekadar kabar buruk. */
const ABANDONED_MESSAGE =
  'Iklannya harus ditonton sampai habis. Jangan keluar atau tekan back di tengah tayangan — tiket belum masuk, coba lagi.'

/** `showGiga()` dapat menolak Promise dengan string, Error, atau objek bermessage. Ringkas alasan tanpa membocorkan objek mentah ke UI. */
function showFailureMessage(reason: string): string {
  const trimmed = reason.trim().slice(0, 80)
  return trimmed ? `${SHOW_FAILED_MESSAGE} (${trimmed})` : SHOW_FAILED_MESSAGE
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
      const outcome = await watchAdToFinish(play)
      /** Tiket pending sengaja dibiarkan terbuka: `openAdTicket` memakai ulang tiket yang sama dan hitungan harian baru naik setelah klaim, jadi tayangan yang ditinggal tidak menghukum siapa pun. */
      if (outcome.status === 'abandoned') {
        notifyError(ABANDONED_MESSAGE)
        return false
      }
      if (outcome.status === 'failed') {
        console.warn('[ads] showGiga() reject', outcome.reason)
        notifyError(showFailureMessage(outcome.reason))
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
