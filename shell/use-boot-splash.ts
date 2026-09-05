'use client'

import { useEffect, useRef, useState } from 'react'

/** Satu denyut penuh lambangnya (`token-beat`, 1,8 detik). Splash ditahan selama itu bahkan ketika
 * sesinya sudah datang lebih cepat, dan itu memang menambah tunggu — jadi angkanya perlu alasan.
 * Alasannya: splash yang dipotong di tengah denyut terbaca sebagai kedipan, bukan sebagai layar.
 * Setengah animasi yang tersapu pergi lebih buruk daripada tidak ada animasi sama sekali, karena
 * yang tertinggal di ingatan cuma "ada yang berkelip". Di Telegram jeda bootnya memang sudah ada
 * — sesi baru terbaca setelah `initData` sampai — jadi yang benar-benar DITAMBAHKAN di sini cuma
 * selisihnya, bukan 1,8 detik penuh.
 *
 * Kalau kelak terasa kepanjangan, ini satu-satunya angka yang perlu diubah — tapi menurunkannya di
 * bawah 1,8 detik mengembalikan denyut yang terpotong, jadi yang benar adalah memperpendek
 * denyutnya lebih dulu di `@keyframes token-beat`. */
export const SPLASH_MIN_MS = 1_800

/** Bar dari posisi tahannya ke penuh. */
export const SPLASH_SETTLE_MS = 240

/** Pudar setelah barnya penuh, bukan bersamaan: "penuh" harus sempat terlihat. */
export const SPLASH_FADE_MS = 260

export type SplashPhase = 'filling' | 'completing' | 'gone'

/** Fase splash boot. `ready` cukup "kueri sesi sudah selesai", termasuk selesai dengan galat —
 * `useRewardSession` menurunkan `loading` di kedua keadaan itu. Menunggu sesi yang BERHASIL akan
 * menahan splash selamanya di layar orang yang koneksinya putus, tepat ketika mereka paling perlu
 * membaca pesan galatnya. */
export function useBootSplash(ready: boolean): SplashPhase {
  const [phase, setPhase] = useState<SplashPhase>('filling')
  /** Dipatok saat render pertama, bukan di dalam effect: effect baru jalan setelah paint, dan
   * selisihnya membuat splash tampil lebih lama daripada angka yang tertulis di atas. */
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (phase !== 'filling' || !ready) return
    const remaining = Math.max(0, SPLASH_MIN_MS - (Date.now() - startedAt.current))
    const timer = setTimeout(() => setPhase('completing'), remaining)
    return () => clearTimeout(timer)
  }, [ready, phase])

  useEffect(() => {
    if (phase !== 'completing') return
    const timer = setTimeout(() => setPhase('gone'), SPLASH_SETTLE_MS + SPLASH_FADE_MS)
    return () => clearTimeout(timer)
  }, [phase])

  return phase
}
