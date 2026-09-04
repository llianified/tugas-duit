'use client'

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** Rail kartu horizontal ala fomo (seksi "Clans"): satu baris kartu yang digulir menyamping, kartu terakhir sengaja terpotong di tepi kanan supaya terlihat masih ada lanjutannya. Seluruh perilakunya sudah ada di `globals.css` — `.rail` (flex + gulir menyamping + scroll-snap + `scroll-padding-inline-start`), `.rail-item` (lebar tetap `--rail-card-w` + titik snap), `.no-scrollbar`, dan `.bleed-x` (menembus padding halaman lalu mengembalikannya sebagai padding dalam). Komponen ini hanya merangkai keempatnya supaya urutannya tidak pernah salah: `.bleed-x` tanpa `.rail` bukan rail, dan `.rail` tanpa `.bleed-x` membuat kartu berhenti di dalam padding halaman alih-alih terpotong di tepi layar. Digulir dengan papan tombol tanpa tambahan apa pun: `overflow-x: auto` dari `.rail` membuat peramban menggulir sendiri saat fokus berpindah ke kartu di luar pandangan. Karena itu `tabIndex` tidak pernah disetel di sini — memberi `tabIndex={0}` pada wadahnya justru menambah perhentian fokus yang tidak mengumumkan apa pun, dan `tabIndex={-1}` akan mematikan gulir bawaannya. */
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
  // `Children.count` menghitung hasil `.map()` yang kosong sebagai 0, sekaligus | mengabaikan `null` / `false` dari kartu yang dirender bersyarat.
  const count = Children.count(children)
  // Jumlah kartu ikut masuk supaya pengukurannya diulang saat isi rail berganti: | menambah kartu mengubah `scrollWidth` tanpa mengubah ukuran rail-nya sendiri, | jadi `ResizeObserver` di dalam hook tidak akan terpicu.
  const { ref, hasMore } = useRailOverflow(count)

  if (count === 0) {
    // Tanpa `.bleed-x`: status kosong adalah blok terpusat, bukan rail, jadi | ia harus tetap berada di dalam padding halaman.
    return empty ? <div className={cn('flex', className)}>{empty}</div> : null
  }

  return (
    <ul
      ref={ref}
      // `role="list"` dipertahankan secara eksplisit karena `list-style: none` | dari preflight menghapus semantik daftar di Safari/VoiceOver.
      role="list"
      aria-label={ariaLabel}
      /* `.rail-fade-e` hanya dipasang selama masih ada kartu di kanan yang belum terlihat: fade adalah petunjuk "geser lagi", jadi menyisakannya saat gulir sudah di ujung justru menjanjikan lanjutan yang tidak ada — dan kartu terakhir tampil separuh pudar tanpa alasan. Lihat `useRailOverflow`. */
      className={cn('rail no-scrollbar bleed-x', hasMore && 'rail-fade-e', className)}
    >
      {children}
    </ul>
  )
}

/** Menjawab satu pertanyaan: masih ada isi di kanan tepi gulir atau tidak. Diukur, bukan disimpulkan dari jumlah kartu — tiga kartu `--rail-card-w` meluap di 384px tapi tidak di layar lebar, dan menebaknya lewat hitungan kartu berarti fade tetap tergambar di rail yang sudah muat seluruhnya. Ambang 1px menyerap `scrollWidth` / `scrollLeft` pecahan yang muncul di layar ber-DPR bukan-bulat; tanpa itu rail yang sudah di ujung tetap menyisakan sisa ~0.5px dan fade-nya tidak pernah hilang. */
function useRailOverflow(count: number) {
  const node = useRef<HTMLUListElement | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const measure = useCallback(() => {
    const el = node.current
    if (!el) return
    setHasMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 1)
  }, [])

  const ref = useCallback(
    (el: HTMLUListElement | null) => {
      node.current = el
      measure()
    },
    [measure],
  )

  useEffect(() => {
    const el = node.current
    if (!el) return

    el.addEventListener('scroll', measure, { passive: true })
    // Lebar rail berubah tanpa event gulir: rotasi layar, kartu yang datang | belakangan, atau font yang baru selesai dimuat.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()

    return () => {
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure, count])

  return { ref, hasMore }
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
