'use client'

import { useCallback, useRef, useState } from 'react'
import { monetagSdkName, type AdProvider } from '@/domain/ads/ads'
import {
  adFailureMessage,
  watchAdToFinish,
  type AdWatchSettled,
} from '@/shell/ad-watch'
import { sendJson, userFacingMessage } from '@/shell/api-client'
import { rewardedPlayer, waitForShow } from '@/shell/monetag-sdk'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

const SDK_MISSING_MESSAGE =
  'Pemutar iklan tidak termuat dalam 8 detik. Periksa koneksi atau pemblokir iklan, lalu coba lagi. Kode: AD-LOAD.'
/** Hanya muncul jika Promise SDK tidak memberi hasil selama tiga menit; perpindahan visibility normal selama iklan tidak lagi memicu pesan ini. */
const ABANDONED_MESSAGE =
  'Penyedia iklan belum memberi hasil setelah 3 menit. Tiket belum masuk dan jatah tetap utuh. Coba lagi. Kode: AD-TIMEOUT.'
const LATE_CLAIM_MESSAGE = 'Tiket iklan masuk. Tayangannya ternyata tuntas.'

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

  /** Rewarded Interstitial dipanggil eksplisit sebagai `type: 'end'`. Ticket ID menjadi `ymid` unik, sedangkan `catchIfNoFeed` memastikan inventory kosong menolak Promise alih-alih menggantung. Zone tetap datang dari server (`unitId`) supaya tiket, script tag, dan `ad_views.block_id` tidak pernah menunjuk zone berbeda. */
  const getPlayer = useCallback(
    async (provider: AdProvider, unitId: string, ticketId: string) => {
      if (provider !== 'monetag' || !unitId) return null
      const show = await waitForShow(monetagSdkName(unitId))
      return show ? rewardedPlayer(show, ticketId) : null
    },
    [],
  )

  const hasPass = Boolean(ads?.pass)

  /** SDK yang melewati backstop ternyata mengonfirmasi tayangan belakangan. Tiketnya masih pending di server, jadi klaimnya sah — membuang hasil terlambat akan membuat user yang sudah menonton penuh tidak mendapat task. */
  const claimWhenLate = useCallback(
    async (late: Promise<AdWatchSettled>, ticketId: string, generation: number) => {
      const outcome = await late
      if (outcome.status !== 'finished') return
      if (watchGeneration.current !== generation) return
      try {
        await sendJson<AdClaimResponse>('/api/ads/claim', 'POST', { ticketId })
        notifySuccess(LATE_CLAIM_MESSAGE)
      } catch {
        // Tiketnya sudah kedaluwarsa atau diklaim ulang lewat tontonan berikutnya. Tidak ada yang perlu dikabarkan: user sudah menerima pesan timeout tadi.
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
      const play = await getPlayer(ticket.provider, ticket.unitId, ticket.ticketId)
      if (!play) {
        notifyError(SDK_MISSING_MESSAGE)
        return false
      }
      const outcome = await watchAdToFinish(play)
      /** Tiket pending sengaja dibiarkan terbuka: `openAdTicket` memakai ulang tiket yang sama dan hitungan harian baru naik setelah klaim, jadi timeout SDK tidak mengurangi jatah siapa pun. */
      if (outcome.status === 'abandoned') {
        notifyError(ABANDONED_MESSAGE)
        void claimWhenLate(outcome.late, ticket.ticketId, generation)
        return false
      }
      if (outcome.status === 'failed') {
        console.warn('[ads] rewarded show_<zone>() reject', outcome.reason)
        notifyError(adFailureMessage(outcome.reason))
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
