'use client'

import { useCallback, useRef, useState } from 'react'
import type { AdProvider } from '@/domain/ads/ads'
import { watchAdToFinish, type AdWatchSettled } from '@/shell/ad-watch'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import { waitForGigaPubShow } from '@/shell/gigapub-sdk'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

const SHOW_FAILED_MESSAGE = 'Iklannya belum selesai. Tiket belum masuk.'
const NO_INVENTORY_MESSAGE = 'Lagi nggak ada iklan buat ditayangkan. Coba lagi sebentar lagi.'
const SDK_MISSING_MESSAGE = 'Iklan gagal dimuat. Coba lagi nanti.'
/** Ditinggal ke halaman pengiklan lalu back: jatah harian dan cooldown belum terpakai, jadi ajakannya mencoba lagi — bukan sekadar kabar buruk. */
const ABANDONED_MESSAGE = 'Iklannya belum tuntas jadi tiket belum masuk. Jatah kamu utuh, coba lagi.'
const LATE_CLAIM_MESSAGE = 'Tiket iklan masuk. Tayangannya ternyata tuntas.'

/** Alasan mentah dari SDK tidak pernah sampai ke user: isinya bahasa Inggris vendor ("no ads available", "closed by user") yang tidak menjelaskan apa pun bagi penonton dan melanggar bahasa UI. Yang dipakai cuma golongannya; teks aslinya berhenti di `console.warn` untuk yang membaca log. */
function showFailureMessage(reason: string): string {
  const marker = reason.toLowerCase()
  const noInventory =
    marker.includes('no ad') || marker.includes('no fill') || marker.includes('empty')
  return noInventory ? NO_INVENTORY_MESSAGE : SHOW_FAILED_MESSAGE
}

export function useAdPass({
  ads,
  notifyError,
  notifySuccess,
  refreshSession,
}: {
  ads: AdsState | null
  notifyError: (message: string) => void
  notifySuccess: (message: string) => void
  refreshSession: () => Promise<unknown>
}) {
  const [watchingAd, setWatchingAd] = useState(false)
  /** Dinaikkan tiap kali tontonan baru dimulai. Klaim susulan memakainya untuk mundur: tiket yang sama sedang ditonton ulang, dan tontonan kedua itu yang berhak mengklaimnya. Tanpa penanda ini keduanya berlomba, yang kalah menerima `no_ticket`, dan user membaca "tiket tidak ketemu" untuk tiket yang justru baru saja masuk. */
  const watchGeneration = useRef(0)

  /** Promise Giga.pub hanya resolve setelah rewarded ad selesai; tiket baru boleh diklaim sesudah itu. Monetag sengaja tidak menjadi fallback karena hanya dipakai untuk in-app. */
  const getPlayer = useCallback(async (provider: AdProvider) => {
    if (provider !== 'gigapub') return null
    return waitForGigaPubShow()
  }, [])

  const hasPass = Boolean(ads?.pass)

  /** Tayangan yang dinyatakan ditinggal ternyata tuntas belakangan. Tiketnya masih pending di server, jadi klaimnya sah — dan diam-diam membuangnya persis sama saja dengan bug yang mau dihindari: user menonton iklan penuh lalu tidak dapat apa-apa. */
  const claimWhenLate = useCallback(
    async (late: Promise<AdWatchSettled>, ticketId: string, generation: number) => {
      const outcome = await late
      if (outcome.status !== 'finished') return
      if (watchGeneration.current !== generation) return
      try {
        await sendJson<AdClaimResponse>('/api/ads/claim', 'POST', { ticketId })
        notifySuccess(LATE_CLAIM_MESSAGE)
      } catch {
        // Tiketnya sudah kedaluwarsa atau sudah diklaim ulang lewat tontonan berikutnya. Tidak ada yang perlu dikabarkan: user sudah menerima pesan "belum tuntas" tadi.
      } finally {
        await refreshSession()
      }
    },
    [notifySuccess, refreshSession],
  )

  const watchAd = useCallback(async (): Promise<boolean> => {
    if (watchingAd) return false
    if (hasPass) return true
    const generation = (watchGeneration.current += 1)
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
        void claimWhenLate(outcome.late, ticket.ticketId, generation)
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
  }, [claimWhenLate, getPlayer, hasPass, notifyError, refreshSession, watchingAd])

  return { watchAd, watchingAd, hasPass }
}
