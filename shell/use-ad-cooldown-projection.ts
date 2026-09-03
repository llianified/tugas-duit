'use client'

import { useEffect, useState } from 'react'
import { secondsUntil } from '@/domain/economy/energy'
import type { AdsState } from '@/shell/session-api'

/** Kembar dari `useRewardPoolProjection` untuk cooldown iklan. Server hanya bisa mengirim potret (`cooldownSecondsLeft`), dan potret itu diam di layar sampai sesi berikutnya termuat — angkanya lalu melompat, bukan berjalan. Yang dipakai di sini adalah tenggatnya (`cooldownUntil`), dimajukan sendiri oleh klien tiap detik, dengan `clockOffset` supaya jam perangkat yang meleset tidak ikut menggeser hitungannya. */
export function useAdCooldownProjection({
  payload,
  refreshSession,
}: {
  payload: AdsState | null
  refreshSession: () => void
}) {
  const clockOffset = payload === null ? 0 : payload.now - payload.receivedAt
  const cooldownUntil = payload?.cooldownUntil ?? null

  const [clientNow, setClientNow] = useState(() => Date.now())
  /** Timer hanya hidup selama masih ada tenggat yang belum lewat; begitu habis, `cooldownUntil` dari sesi berikutnya null dan interval-nya berhenti sendiri. */
  const cooling = cooldownUntil !== null && cooldownUntil > clientNow + clockOffset
  useEffect(() => {
    if (!cooling) return
    const timer = setInterval(() => setClientNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [cooling])

  const now = clientNow + clockOffset
  const secondsLeft = secondsUntil(cooldownUntil, now) ?? 0

  /** Saat proyeksi menyentuh nol, sesi di-refresh sekali supaya tombolnya berganti dari "Iklan belum siap" ke "Iklan" tanpa menunggu interaksi lain. Tanpa ini hitungan mundur selesai tapi tombolnya tetap terkunci sampai ada pemicu lain. */
  const drained = cooldownUntil !== null && secondsLeft === 0
  useEffect(() => {
    if (drained) refreshSession()
  }, [drained, refreshSession])

  return { adCooldownSecondsLeft: secondsLeft }
}
