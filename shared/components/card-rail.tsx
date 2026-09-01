'use client'

import { Children, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Rail kartu horizontal ala fomo (seksi "Clans"): satu baris kartu yang
 * digulir menyamping, kartu terakhir sengaja terpotong di tepi kanan supaya
 * terlihat masih ada lanjutannya.
 *
 * Seluruh perilakunya sudah ada di `globals.css` — `.rail` (flex + gulir
 * menyamping + scroll-snap + `scroll-padding-inline-start`), `.rail-item`
 * (lebar tetap `--rail-card-w` + titik snap), `.no-scrollbar`, dan `.bleed-x`
 * (menembus padding halaman lalu mengembalikannya sebagai padding dalam).
 * Komponen ini hanya merangkai keempatnya supaya urutannya tidak pernah salah:
 * `.bleed-x` tanpa `.rail` bukan rail, dan `.rail` tanpa `.bleed-x` membuat
 * kartu berhenti di dalam padding halaman alih-alih terpotong di tepi layar.
 *
 * Digulir dengan papan tombol tanpa tambahan apa pun: `overflow-x: auto` dari
 * `.rail` membuat peramban menggulir sendiri saat fokus berpindah ke kartu di
 * luar pandangan. Karena itu `tabIndex` tidak pernah disetel di sini — memberi
 * `tabIndex={0}` pada wadahnya justru menambah perhentian fokus yang tidak
 * mengumumkan apa pun, dan `tabIndex={-1}` akan mematikan gulir bawaannya.
 */
export function CardRail({
  ariaLabel,
  children,
  empty,
  className,
}: {
  ariaLabel: string
  children: ReactNode
  /** Ditampilkan menggantikan rail saat tidak ada satu pun kartu. */
  empty?: ReactNode
  className?: string
}) {
  // `Children.count` menghitung hasil `.map()` yang kosong sebagai 0, sekaligus
  // mengabaikan `null` / `false` dari kartu yang dirender bersyarat.
  const isEmpty = Children.count(children) === 0

  if (isEmpty) {
    // Tanpa `.bleed-x`: status kosong adalah blok terpusat, bukan rail, jadi
    // ia harus tetap berada di dalam padding halaman.
    return empty ? <div className={cn('flex', className)}>{empty}</div> : null
  }

  return (
    <ul
      // `role="list"` dipertahankan secara eksplisit karena `list-style: none`
      // dari preflight menghapus semantik daftar di Safari/VoiceOver.
      role="list"
      aria-label={ariaLabel}
      className={cn('rail no-scrollbar bleed-x', className)}
    >
      {children}
    </ul>
  )
}

/** Satu kartu di dalam `CardRail`. Lebarnya dikunci `--rail-card-w`. */
export function CardRailItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <li className={cn('rail-item', className)}>{children}</li>
}
