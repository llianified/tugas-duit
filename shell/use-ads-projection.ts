'use client'

import { useEffect, useState } from 'react'
import { secondsUntil } from '@/domain/economy/energy'
import type { AdsState } from '@/shell/session-api'

/** Kembar dari `useRewardPoolProjection` untuk dua tenggat milik iklan: cooldown antar tayangan dan umur tiket yang sudah didapat. Server hanya bisa mengirim potret, dan potret itu diam di layar sampai sesi berikutnya termuat — angkanya lalu melompat, bukan berjalan. Yang dipakai di sini adalah tenggatnya (`cooldownUntil`, `pass.expiresAt`), dimajukan sendiri oleh klien tiap detik, dengan `clockOffset` supaya jam perangkat yang meleset tidak ikut menggeser hitungannya.
 *
 * Keduanya berbagi satu detak. Tenggatnya beda arti tapi bentuknya sama, dan dua interval terpisah untuk hal yang sama-sama berdetak per detik hanya menggandakan render tanpa menambah ketelitian. */
export function useAdsProjection({
  payload,
  refreshSession,
}: {
  payload: AdsState | null
  refreshSession: () => void
}) {
  const clockOffset = payload === null ? 0 : payload.now - payload.receivedAt
  const cooldownUntil = payload?.cooldownUntil ?? null
  const passExpiresAt = payload?.pass?.expiresAt ?? null

  const [clientNow, setClientNow] = useState(() => Date.now())
  /** Timer hanya hidup selama masih ada tenggat yang belum lewat; begitu habis, tenggat dari sesi berikutnya null dan interval-nya berhenti sendiri. */
  const ticking =
    (cooldownUntil !== null && cooldownUntil > clientNow + clockOffset) ||
    (passExpiresAt !== null && passExpiresAt > clientNow + clockOffset)
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setClientNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [ticking])

  const now = clientNow + clockOffset
  const cooldownSecondsLeft = secondsUntil(cooldownUntil, now) ?? 0
  const passSecondsLeft = secondsUntil(passExpiresAt, now)

  /** Saat proyeksi menyentuh nol, sesi di-refresh sekali supaya tombolnya berganti dari "Iklan belum siap" ke "Iklan" tanpa menunggu interaksi lain. Tanpa ini hitungan mundur selesai tapi tombolnya tetap terkunci sampai ada pemicu lain. */
  const cooldownDrained = cooldownUntil !== null && cooldownSecondsLeft === 0
  /** Tiket yang lewat tenggatnya harus hilang dari layar pada detik yang sama, bukan menunggu sesi berikutnya: tombol "Pakai tiket" yang masih terpampang setelah tiketnya mati adalah tombol yang dijamin gagal ditekan. */
  const passDrained = passExpiresAt !== null && passSecondsLeft === 0
  useEffect(() => {
    if (cooldownDrained || passDrained) refreshSession()
  }, [cooldownDrained, passDrained, refreshSession])

  return {
    adCooldownSecondsLeft: cooldownSecondsLeft,
    /** Sisa umur tiket dalam detik; `null` kalau memang tidak ada tiket. */
    adPassSecondsLeft: passSecondsLeft,
    /** Tiketnya ada di potret sesi tapi tenggatnya sudah lewat menurut jam terkoreksi. */
    adPassExpired: passDrained,
  }
}
