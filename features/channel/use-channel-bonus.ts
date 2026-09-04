'use client'

import { useCallback, useState } from 'react'
import { userFacingMessage } from '@/shell/api-client'
import { hapticSuccess, hapticTap } from '@/shared/lib/haptic'
import { claimChannelBonus, type ChannelBonusState } from '@/shell/session-api'
import { useToast } from '@/shell/toast'

/** Panjang cap, dan satu-satunya tempat angkanya ditulis. Kartunya memasang nilai ini sebagai `--stamp-ms` — CSS yang menggambar capnya dan JS yang menahan penyegaran sesi membaca sumber yang sama, persis seperti `TEAR_MS` di karcis task. Sebelum bentuknya jadi perangko, kuponnya disobek dan angka ini bernama `COUPON_TEAR_MS`; capnya sedikit lebih lama karena ia punya dua babak — ditekankan, lalu dibaca — sementara sobekan cuma satu gerak. */
export const CHANNEL_STAMP_MS = 640

/** Versi tanpa gerak: yang tersisa hanya fade 200ms, jadi jedanya juga pendek. Angkanya harus sama dengan `fade-in` di aturan `prefers-reduced-motion` milik `.stamp[data-stamping='true']`. */
const STAMP_REDUCED_MS = 200

function stampDuration() {
  if (typeof window === 'undefined') return CHANNEL_STAMP_MS
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return reduced ? STAMP_REDUCED_MS : CHANNEL_STAMP_MS
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Satu tempat yang memutuskan apakah bonus ini masih ada. Sebelumnya syaratnya ditulis dua kali: kartunya menjaga dirinya sendiri dengan `!bonus.enabled || bonus.claimed`, dan `HomeView` menghitung ulang kebalikannya untuk tahu apakah perlu memberi jarak ke kartu di bawahnya. Sekarang jawabannya juga yang memutuskan apakah kartunya ikut masuk carousel — jadi mematikan bonus lewat konfigurasi membuat carousel-nya menyusut jadi satu kartu tunggal tanpa titik, bukan menyisakan slide kosong. Sebagai type predicate, hasilnya sekaligus menyempitkan `ChannelBonusState | null` menjadi non-null, jadi pemanggilnya tidak perlu mengecek dua kali. */
export function channelBonusReachable(
  bonus: ChannelBonusState | null,
): bonus is ChannelBonusState {
  return bonus !== null && bonus.enabled && !bonus.claimed
}

/** Klaim bonus channel: haptic, panggil API, segarkan sesi, dan tampilkan galat. Dipisah dari komponennya mengikuti `useMissions` — kartunya tinggal menggambar, dan satu-satunya aksi di dalamnya tidak lagi membawa `useState`, `try/finally`, serta `useToast` sendiri. `hapticTap()` ikut ke sini supaya tombol klaim terasa sama dengan tombol klaim misi, yang sejak awal punya getaran itu sementara tombol ini tidak. */
export function useChannelBonus({ onClaimed }: { onClaimed: () => Promise<unknown> }) {
  const [claiming, setClaiming] = useState(false)
  const [stamped, setStamped] = useState(false)
  const showError = useToast()

  const claim = useCallback(async () => {
    hapticTap()
    setClaiming(true)

    try {
      await claimChannelBonus()
    } catch (cause) {
      // Gagal sebelum apa pun terjadi: perangkonya masih bersih, jadi tidak ada | yang perlu dicap dan tombolnya dikembalikan supaya bisa dicoba lagi.
      showError(userFacingMessage(cause))
      setClaiming(false)
      return
    }

    // Bonusnya sudah pindah ke saldo di server. Dari titik ini perangkonya habis, | dan `stamped` tidak pernah dikembalikan ke `false`: membatalkan cap setelah | klaim berhasil akan menggambarkan keadaan yang tidak benar.
    hapticSuccess()
    setStamped(true)
    await sleep(stampDuration())

    // Sengaja setelah animasinya. `onClaimed` menyegarkan sesi, dan sesi baru | membuat `channelBonusReachable` bernilai `false` — yang melepas kartu ini | dari carousel beranda. Dipanggil lebih awal, capnya tidak pernah terlihat. | `claiming` juga tidak pernah dikembalikan ke `false` di jalur ini: selama | capnya tombolnya harus tetap mati, dan sesudahnya kartunya sudah tidak ada | untuk dibaca ulang.
    try {
      await onClaimed()
    } catch (cause) {
      showError(userFacingMessage(cause))
    }
  }, [onClaimed, showError])

  return { claiming, stamped, claim }
}
