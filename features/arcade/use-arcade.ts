'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { arcadeCooldownLeft, type ArcadeGame, type ArcadePrize } from '@/domain/arcade/arcade'
import type {
  ArcadeOpenResponse,
  ArcadeSettleResponse,
  ArcadeStateResponse,
} from '@/features/arcade/types'
import { fetchJson, sendJson, userFacingMessage } from '@/shell/api-client'
import { hapticTap } from '@/shared/lib/haptic'
import { useToast } from '@/shell/toast'

/** idle: belum ada ronde. | opening: ongkos masuk sedang dibayar (iklan lalu `/api/arcade/open`). | playing: ronde berjalan di klien. | settling: hasil sedang dikirim. | result: hadiah sudah diketahui. */
export type ArcadePhase = 'idle' | 'opening' | 'playing' | 'settling' | 'result'

export interface ArcadeResult {
  prize: ArcadePrize
  boxes: ArcadePrize[] | null
  pick: number | null
}

/** Arena memuat datanya sendiri lewat `/api/arcade`, tidak menumpang payload sesi. Alasannya sama dengan misi: jatah main dan jeda berubah tiap kali user main, sementara sesi dibaca jauh lebih jarang — menitipkannya di sana berarti angka jatah tertinggal di belakang apa yang baru saja dilakukan. | Yang TIDAK dipegang hook ini: menonton iklannya sendiri. Itu milik `useAdPass` di shell, dan dioper ke sini lewat `watchAd` supaya hanya ada satu jalur tontonan iklan di seluruh app. */
export function useArcade({
  watchAd,
  refreshSession,
}: {
  /** Menonton satu iklan berhadiah sampai tuntas, meninggalkan pass siap pakai di server. Mengembalikan false kalau tayangannya gagal atau ditinggal. */
  watchAd: () => Promise<boolean>
  refreshSession: () => Promise<unknown>
}) {
  const [state, setState] = useState<ArcadeStateResponse | null>(null)
  const [receivedAt, setReceivedAt] = useState(() => Date.now())
  const [phase, setPhase] = useState<ArcadePhase>('idle')
  const [game, setGame] = useState<ArcadeGame | null>(null)
  const [playId, setPlayId] = useState<string | null>(null)
  const [result, setResult] = useState<ArcadeResult | null>(null)
  const showError = useToast()

  const load = useCallback(async () => {
    try {
      const next = await fetchJson<ArcadeStateResponse>('/api/arcade')
      setState(next)
      setReceivedAt(Date.now())
    } catch {
      setState(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** `/api/arcade` hanya dibaca ulang saat ronde dibuka atau disetel, jadi jedanya harus dimajukan sendiri di klien — kalau tidak, "Jeda 05:00" membeku di layar dan tombol Main tidak pernah hidup lagi sampai view-nya dipasang ulang. Pola dan alasannya sama dengan `useAdsProjection`, termasuk koreksi selisih jam perangkat lewat `state.now`. */
  const [clientNow, setClientNow] = useState(() => Date.now())
  const clockOffset = state === null ? 0 : state.now - receivedAt
  const cooldownSecondsLeft =
    state === null
      ? 0
      : arcadeCooldownLeft(state.cooldownUntil, clientNow + clockOffset, state.cooldownSecondsLeft)

  const ticking = cooldownSecondsLeft > 0
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setClientNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [ticking])

  /** Jeda yang habis membebaskan `refusal` dan `hasAdPass` juga, dan keduanya cuma diketahui server. Satu muat ulang saat hitungannya menyentuh nol, bukan polling berkala. */
  const cooldownDrained = state !== null && state.cooldownSecondsLeft > 0 && cooldownSecondsLeft === 0
  useEffect(() => {
    if (cooldownDrained) void load()
  }, [cooldownDrained, load])

  /** Ronde yang masih terbuka dari sesi sebelumnya diambil alih, bukan diabaikan. Tanpa ini user yang app-nya tertutup di tengah ronde melihat tombol "Main" yang pasti ditolak `play_open`, dan pass iklannya terlihat hilang begitu saja sampai TTL-nya lewat. */
  useEffect(() => {
    if (!state?.openPlay || phase !== 'idle') return
    setGame(state.openPlay.game)
    setPlayId(state.openPlay.id)
    setPhase('playing')
  }, [phase, state])

  const start = useCallback(
    async (next: ArcadeGame) => {
      hapticTap()
      setPhase('opening')
      setResult(null)
      try {
        /** Iklannya ditonton lebih dulu, dan hasilnya baru ditukar jadi ronde. Kalau tayangannya batal, tidak ada baris `arcade_plays` yang tertulis — jadi jatah harian user utuh dan tidak ada yang perlu dikembalikan. */
        if (state?.adGated && !state.hasAdPass && !(await watchAd())) {
          setPhase('idle')
          return
        }
        const opened = await sendJson<ArcadeOpenResponse>('/api/arcade/open', 'POST', {
          game: next,
        })
        setGame(next)
        setPlayId(opened.play.id)
        setPhase('playing')
      } catch (cause) {
        showError(userFacingMessage(cause))
        setPhase('idle')
      } finally {
        await load()
      }
    },
    [load, showError, state, watchAd],
  )

  const settle = useCallback(
    async (payload: { pick?: number; won?: boolean }) => {
      if (!playId) return
      setPhase('settling')
      try {
        const settled = await sendJson<ArcadeSettleResponse>('/api/arcade/settle', 'POST', {
          playId,
          ...payload,
        })
        setResult({
          prize: settled.prize,
          boxes: settled.boxes,
          pick: payload.pick ?? null,
        })
        setPhase('result')
      } catch (cause) {
        showError(userFacingMessage(cause))
        setPhase('idle')
      } finally {
        setPlayId(null)
        /** Hadiahnya menyentuh stok dan energi, dua angka yang hidup di payload sesi — tanpa penyegaran ini header masih memperlihatkan angka sebelum menang. */
        await Promise.all([load(), refreshSession()])
      }
    },
    [load, playId, refreshSession, showError],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    setGame(null)
    setResult(null)
  }, [])

  /** Jedanya ditumpangkan ke potret supaya layar tetap membaca SATU sumber. Yang dipakai efek dan aksi di atas tetap `state` mentah: memberi mereka objek yang identitasnya berubah tiap detik akan menjalankan ulang pengambilalihan ronde dan menyusun ulang `start` pada setiap tick. */
  const view = useMemo(
    () => (state === null ? null : { ...state, cooldownSecondsLeft }),
    [cooldownSecondsLeft, state],
  )

  return { state: view, phase, game, result, start, settle, reset, reload: load }
}
