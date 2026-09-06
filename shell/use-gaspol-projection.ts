'use client'

import { useEffect, useState } from 'react'

/** Kembar paling kecil dari `useAdsProjection`, untuk satu tenggat: jendela Pass Gaspol.
 *
 * Bentuknya sama karena masalahnya sama. Server cuma bisa mengirim potret, dan potret itu diam di
 * layar sampai sesi berikutnya termuat — jadi pass yang tenggatnya lewat di tengah pemakaian tetap
 * terbaca menyala, dan tombol mulai membiarkan user berangkat dengan energi kosong ke permintaan
 * yang pasti ditolak server. Yang dipakai di sini tenggatnya, dimajukan sendiri klien tiap detik,
 * dengan `clockOffset` supaya jam perangkat yang meleset tidak ikut menggeser hitungannya.
 *
 * `Date.now()` tidak pernah dipanggil saat render — itu aturan kemurnian React yang sama yang
 * membuat `useAdsProjection` menyimpan jamnya di state, bukan membacanya langsung di badan hook. */
export function useGaspolProjection({
  until,
  clockOffset,
  refreshSession,
}: {
  /** Tenggat dari potret sesi. `null` = tidak sedang punya pass. */
  until: number | null
  /** Selisih jam server dan perangkat, diambil dari potret yang membawanya (energi). */
  clockOffset: number
  refreshSession: () => void
}) {
  const [clientNow, setClientNow] = useState(() => Date.now())
  const active = until !== null && until > clientNow + clockOffset

  /** Timer hanya hidup selama pass-nya masih berjalan; begitu lewat, tenggat dari sesi berikutnya
   * `null` dan interval-nya berhenti sendiri. */
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setClientNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [active])

  /** Sesi disegarkan sekali saat jendelanya menyentuh nol, supaya petak biaya di karcis berganti
   * dari "0 · pass gaspol" kembali ke "1 energi" tanpa menunggu interaksi lain. */
  const drained = until !== null && !active
  useEffect(() => {
    if (drained) refreshSession()
  }, [drained, refreshSession])

  const secondsLeft = active
    ? Math.max(0, Math.ceil(((until as number) - clientNow - clockOffset) / 1_000))
    : null

  return { gaspolActive: active, gaspolSecondsLeft: secondsLeft }
}
