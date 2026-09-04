'use client'

import { useCallback, useRef, useState } from 'react'
import { adPassUsable, monetagSdkName, type AdProvider } from '@/domain/ads/ads'
import {
  adFailureMessage,
  watchAdToFinish,
  type AdWatchSettled,
} from '@/shell/ad-watch'
import { ApiError, sendJson, userFacingMessage } from '@/shell/api-client'
import { rewardedPlayer, waitForShow } from '@/shell/monetag-sdk'
import type { AdClaimResponse, AdsState, AdTicketResponse } from '@/shell/session-api'

const SDK_MISSING_MESSAGE =
  'Iklannya nggak mau kebuka. Cek koneksi atau pemblokir iklan, terus coba lagi.'
/** Hanya muncul jika Promise SDK tidak memberi hasil selama tiga menit; perpindahan visibility normal selama iklan tidak lagi memicu pesan ini. */
const ABANDONED_MESSAGE =
  'Iklannya kelamaan nggak selesai. Coba lagi ya, jatah kamu aman.'
const LATE_CLAIM_MESSAGE = 'Tiketnya masuk kok, iklannya ternyata kelar.'
/** Konfirmasi Monetag datang ke server, bukan ke perangkat ini, jadi satu-satunya cara klien mengetahuinya adalah bertanya berulang. Jendelanya sengaja pendek: yang ditunggu perjalanan satu permintaan antar-server, bukan tayangan iklannya — yang itu sudah selesai sebelum baris ini jalan. */
const VERIFY_POLL_MS = 2_500
const VERIFY_WINDOW_MS = 20_000
const AWAITING_CODE = 'AD_CLAIM_AWAITING_VERIFICATION'
/** Tiketnya TIDAK hangus di sini. Kalau konfirmasinya datang setelah jendela ini lewat, `settleAdPostback` tetap menerbitkan passnya di server dan user menemukannya sudah siap saat kembali — jadi pesannya tidak boleh berbunyi seperti kegagalan yang final. */
const AWAITING_MESSAGE =
  'Tiketnya lagi diproses. Masuk sendiri kok, cek lagi sebentar lagi.'

const isAwaiting = (error: unknown) => error instanceof ApiError && error.code === AWAITING_CODE

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
  /** Penjaga sinkron; `watchingAd` hanya menggerakkan tombolnya. Dua ketukan cepat terjadi sebelum
   * render berikutnya, jadi keduanya membaca `watchingAd` yang masih `false` dan sama-sama membuka
   * tiket. Pola yang sama dipakai `shell/use-task-flow.ts`. */
  const watchingAdRef = useRef(false)
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

  /** Satu klaim saat gerbang postback mati, polling saat menyala. Bentuknya sengaja satu jalur untuk dua mode: yang membedakan cuma jawaban server, jadi klien tidak perlu tahu setelan panelnya sama sekali. */
  const claimTicket = useCallback(async (ticketId: string): Promise<boolean> => {
    const deadline = Date.now() + VERIFY_WINDOW_MS
    for (;;) {
      try {
        await sendJson<AdClaimResponse>('/api/ads/claim', 'POST', { ticketId })
        return true
      } catch (error) {
        if (!isAwaiting(error)) throw error
        if (Date.now() >= deadline) {
          notifyError(AWAITING_MESSAGE)
          return false
        }
        await new Promise((resolve) => setTimeout(resolve, VERIFY_POLL_MS))
      }
    }
  }, [notifyError])

  const hasPass = Boolean(ads?.pass)

  /** Tiket yang masih BISA DIPAKAI, bukan cuma yang ada di potret. Potret sesi tetap menyebut tiketnya ada sampai muat ulang berikutnya, jadi `hasPass` sendirian membuat `watchAd` menjawab "sudah punya" untuk tiket yang tenggatnya lewat — dan pemanggilnya lalu mengirim permintaan yang dijamin ditolak `consumeAdPass`, tanpa satu iklan pun ditonton. Jamnya dikoreksi ke jam server lewat `now - receivedAt`, sama seperti `useAdsProjection`. */
  const passUsable = useCallback(
    () => adPassUsable(ads?.pass, Date.now() + (ads ? ads.now - ads.receivedAt : 0)),
    [ads],
  )

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
        // Tiketnya sudah kedaluwarsa, diklaim ulang lewat tontonan berikutnya, atau konfirmasi Monetag belum datang. Tidak ada yang perlu dikabarkan: user sudah menerima pesan timeout tadi, dan pass yang dikonfirmasi belakangan tetap diterbitkan server sendiri.
      } finally {
        await refreshSession()
      }
    },
    [notifySuccess, refreshSession],
  )

  const watchAd = useCallback(async (): Promise<boolean> => {
    if (watchingAdRef.current) return false
    if (passUsable()) return true
    const generation = (watchGeneration.current += 1)
    watchingAdRef.current = true
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
      return await claimTicket(ticket.ticketId)
    } catch (error) {
      notifyError(userFacingMessage(error))
      return false
    } finally {
      watchingAdRef.current = false
      setWatchingAd(false)
      await refreshSession()
    }
  }, [claimTicket, claimWhenLate, getPlayer, notifyError, passUsable, refreshSession])

  return { watchAd, watchingAd, hasPass }
}
