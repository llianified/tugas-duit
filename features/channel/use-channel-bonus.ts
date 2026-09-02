'use client'

import { useCallback, useState } from 'react'
import { userFacingMessage } from '@/shell/api-client'
import { hapticSuccess, hapticTap } from '@/shared/lib/haptic'
import { claimChannelBonus, type ChannelBonusState } from '@/shell/session-api'
import { useToast } from '@/shell/toast'

/** Panjang sobekan kupon, dan satu-satunya tempat angkanya ditulis. Sebelumnya nilainya (690ms) harus dicocokkan dengan tangan ke tiga durasi terpisah di CSS, dan mengubah salah satunya diam-diam memotong yang lain. Sekarang kartunya memasang angka ini sebagai `--tear-ms` — CSS yang menggambar dan JS yang menahan penyegaran sesi membaca sumber yang sama, persis seperti `TEAR_MS` di karcis task. */
export const COUPON_TEAR_MS = 520

/** Versi tanpa gerak: yang tersisa hanya fade 200ms, jadi jedanya juga pendek. */
const TEAR_REDUCED_MS = 200

function tearDuration() {
  if (typeof window === 'undefined') return COUPON_TEAR_MS
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return reduced ? TEAR_REDUCED_MS : COUPON_TEAR_MS
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Satu tempat yang memutuskan apakah bonus ini masih ada. Sebelumnya syaratnya ditulis dua kali: kartunya menjaga dirinya sendiri dengan `!bonus.enabled || bonus.claimed`, dan `HomeView` menghitung ulang kebalikannya untuk tahu apakah perlu memberi jarak ke kartu di bawahnya. Dua salinan aturan yang sama di dua lapisan berbeda berarti mematikan bonus lewat konfigurasi bisa menyisakan jarak kosong di Beranda — kartunya hilang, `region-gap-t` di atasnya tidak. Sebagai type predicate, hasilnya sekaligus menyempitkan `ChannelBonusState | null` menjadi non-null, jadi pemanggilnya tidak perlu mengecek dua kali. */
export function channelBonusReachable(
  bonus: ChannelBonusState | null,
): bonus is ChannelBonusState {
  return bonus !== null && bonus.enabled && !bonus.claimed
}

/** Klaim bonus channel: haptic, panggil API, segarkan sesi, dan tampilkan galat. Dipisah dari komponennya mengikuti `useMissions` — kartunya tinggal menggambar, dan satu-satunya aksi di dalamnya tidak lagi membawa `useState`, `try/finally`, serta `useToast` sendiri. `hapticTap()` ikut ke sini supaya tombol klaim terasa sama dengan tombol klaim misi, yang sejak awal punya getaran itu sementara tombol ini tidak. */
export function useChannelBonus({ onClaimed }: { onClaimed: () => Promise<unknown> }) {
  const [claiming, setClaiming] = useState(false)
  const [torn, setTorn] = useState(false)
  const showError = useToast()

  const claim = useCallback(async () => {
    hapticTap()
    setClaiming(true)

    try {
      await claimChannelBonus()
    } catch (cause) {
      // Gagal sebelum apa pun terjadi: kuponnya masih utuh, jadi tidak ada yang | perlu disobek dan tombolnya dikembalikan supaya bisa dicoba lagi.
      showError(userFacingMessage(cause))
      setClaiming(false)
      return
    }

    // Bonusnya sudah pindah ke saldo di server. Dari titik ini kuponnya habis, | dan `torn` tidak pernah dikembalikan ke `false`: membatalkan sobekan | setelah klaim berhasil akan menggambarkan keadaan yang tidak benar.
    hapticSuccess()
    setTorn(true)
    await sleep(tearDuration())

    // Sengaja setelah animasinya. `onClaimed` menyegarkan sesi, dan sesi baru | membuat `channelBonusReachable` bernilai `false` — yang melepas kartu ini | dari Beranda. Dipanggil lebih awal, sobekannya tidak pernah terlihat. | `claiming` juga tidak pernah dikembalikan ke `false` di jalur ini: selama | sobekannya tombolnya harus tetap mati, dan sesudahnya kartunya sudah tidak | ada untuk dibaca ulang.
    try {
      await onClaimed()
    } catch (cause) {
      showError(userFacingMessage(cause))
    }
  }, [onClaimed, showError])

  return { claiming, torn, claim }
}
