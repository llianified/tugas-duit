'use client'

import { useCallback, useState } from 'react'
import { monetagSdkName } from '@/domain/ads'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

/**
 * SDK Monetag hanya menempel satu fungsi global per zone — namanya diambil dari atribut
 * `data-sdk` di script tag (lihat `app/layout.tsx`), jadi bentuknya `show_<zone>`. Tidak
 * ada `init`, tidak ada instance yang perlu di-cache atau di-`destroy`: zone-nya sudah
 * menempel di script tag, dan fungsinya boleh dipanggil berulang.
 */
type MonetagShow = (params?: unknown) => Promise<unknown>

/**
 * Nama fungsinya baru diketahui saat runtime (`show_<zone>`), jadi pembacaannya lewat
 * indeks — bukan properti bernama pada `Window`. `unknown` dulu, baru dipastikan callable,
 * supaya SDK yang belum termuat atau berubah bentuk tidak lolos jadi `TypeError`.
 */
function readShow(name: string): MonetagShow | undefined {
  const candidate = (globalThis as unknown as Record<string, unknown>)[name]
  return typeof candidate === 'function' ? (candidate as MonetagShow) : undefined
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

/**
 * `show_<zone>()` bisa reject karena dua hal yang tampak sama di UI tapi beda akarnya:
 * penonton menutup iklan lebih awal (wajar), atau kreatifnya memang tidak pernah termuat
 * (stok kosong / diblokir). Monetag tidak menjanjikan bentuk error tertentu — kadang
 * string, kadang `Error`, kadang objek — jadi alasannya diringkas apa adanya dan
 * ditempelkan ke pesan. Tanpa ini satu-satunya petunjuk yang tersisa cuma "belum selesai
 * ditonton", yang menyesatkan saat penyebabnya iklan gagal muat.
 */
function showFailureReason(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

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
   * Mengembalikan fungsi tayang, bukan SDK-nya: `ticketId` ikut dikirim sebagai `ymid`
   * supaya satu tayangan Monetag bisa dicocokkan dengan barisnya di `ad_views` kalau
   * suatu saat postback server-ke-server mereka dipakai.
   */
  const getPlayer = useCallback(async (unitId: string, ticketId: string) => {
    const name = monetagSdkName(unitId)
    const show = await waitFor(() => readShow(name))
    if (!show) return null
    return () => show({ ymid: ticketId })
  }, [])

  const hasPass = Boolean(ads?.pass)

  const watchAd = useCallback(async (): Promise<boolean> => {
    if (watchingAd) return false
    if (hasPass) return true
    setWatchingAd(true)
    try {
      const ticket = await sendJson<AdTicketResponse>('/api/ads/ticket', 'POST')
      const play = await getPlayer(ticket.unitId, ticket.ticketId)
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
