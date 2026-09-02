'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

/** Jeda antar kartu. Lima detik: cukup lama untuk membaca tiga baris kartu perangko sampai habis, cukup pendek untuk sempat terlihat sebelum halaman digulir lewat. */
export const CARD_CAROUSEL_MS = 5000

/** Jarak geser yang dianggap sebagai "swipe", bukan sebagai tekan yang tangannya bergetar. 44px kira-kira selebar satu bidang sentuh — di bawah itu, tombol di dalam kartu tidak akan pernah bisa ditekan tanpa memindahkan kartunya. */
const SWIPE_PX = 44

/** Satu tempat di beranda yang diisi bergantian oleh beberapa kartu. Bukan rail seperti `CardRail`: rail memperlihatkan kartu berikutnya terpotong di tepi supaya jelas ada lanjutannya, sementara di sini kartunya berukuran penuh dan yang bergantian justru harus tampil UTUH satu per satu — dua perangko yang separuh terlihat berdampingan cuma jadi dua kartu rusak. Yang dijaga komponen ini: kartu yang sedang tidak tampil tidak boleh bisa difokus atau dibaca pembaca layar (`inert`), karena tombol yang tak terlihat tetap jadi perhentian Tab kalau dibiarkan. Rotasinya BERHENTI selama disentuh, di-hover, sedang difokus dari papan tombol, atau tabnya tidak terlihat. Alasannya sama untuk keempatnya: semuanya tanda kartunya sedang dibaca atau dipakai, dan kartu yang pergi di tengah jempol turun ke tombol berarti menekan tombol yang bukan tujuannya. Dengan SATU kartu, bentuk ini tidak dipakai sama sekali — tanpa trek, tanpa titik. Titik tunggal bukan penunjuk apa pun; ia cuma menjanjikan kartu lain yang tidak ada. */
export function CardCarousel({
  ariaLabel,
  items,
  className,
}: {
  ariaLabel: string
  /** Sudah tersaring oleh pemanggilnya: kartu yang tidak tersedia tidak masuk daftar sama sekali, bukan masuk sebagai `null`. Kalau `null` ikut masuk, ia terhitung sebagai slide dan carousel-nya berputar ke halaman kosong. */
  items: { key: string; label: string; node: ReactNode }[]
  className?: string
}) {
  const count = items.length
  const [slide, setSlide] = useState(0)
  const [held, setHeld] = useState(false)
  const { viewportRef, onPointerDown } = useSwipe({ count, setSlide })

  /** Kartunya bisa hilang — bonus yang diklaim melepas dirinya dari daftar — dan indeksnya bisa tertinggal di slide yang sudah tidak ada. Diperbaiki di sini, bukan lewat `key` di induknya: mengganti `key` akan membuang juga posisi kartu yang MASIH ada. */
  const active = count === 0 ? 0 : Math.min(slide, count - 1)

  useEffect(() => {
    if (count < 2 || held) return

    const timer = window.setInterval(() => {
      // Dibaca dari state sebelumnya, bukan dari `active`: dengan `active` di
      // dalam dependensi, tiap perpindahan menyetel ulang intervalnya — dan
      // swipe manual akan memberi kartu berikutnya jeda penuh lima detik lagi.
      setSlide((current) => (current + 1) % count)
    }, CARD_CAROUSEL_MS)

    return () => window.clearInterval(timer)
  }, [count, held])

  useEffect(() => {
    if (count < 2) return

    // Tab yang tidak terlihat tetap menjalankan interval-nya, jadi kembali ke
    // tab setelah semenit berarti kartunya sudah berputar belasan kali tanpa
    // pernah dibaca. Yang dijeda rotasinya, bukan timernya sendiri.
    const onVisibility = () => setHeld(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()

    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [count])

  if (count === 0) return null

  /** Satu kartu: dikembalikan apa adanya. Membungkusnya dengan viewport tetap akan memasang `overflow: hidden` yang memotong cincin fokus tombol di tepi kartu, dan tidak ada satu pun perilaku carousel yang berguna untuk satu kartu. */
  if (count === 1) {
    const only = items[0]
    return <div className={className}>{only.node}</div>
  }

  return (
    <div className={className}>
      <div
        ref={viewportRef}
        // `group`, bukan `region`: isinya kartu-kartu yang masing-masing sudah
        // punya `aria-label` sendiri, jadi ini pengelompokan — bukan tengara
        // baru yang ikut masuk daftar landmark halaman.
        role="group"
        aria-label={ariaLabel}
        className="card-carousel-viewport"
        onPointerDown={onPointerDown}
        onPointerEnter={(event) => {
          // Hanya tetikus. Di layar sentuh, `pointerenter` ikut terkirim saat
          // jempol menyentuh — dan karena tidak ada `pointerleave` yang pasti
          // menyusul, rotasinya bisa berhenti selamanya setelah satu sentuhan.
          if (event.pointerType === 'mouse') setHeld(true)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setHeld(false)
        }}
        onFocusCapture={() => setHeld(true)}
        onBlurCapture={(event) => {
          // Fokus yang pindah antar tombol DI DALAM kartu yang sama bukan
          // alasan melanjutkan rotasi, jadi yang dilihat tujuannya.
          if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false)
        }}
      >
        <div className="card-carousel-track" style={{ '--slide': active } as CSSProperties}>
          {items.map((item, index) => (
            <div
              key={item.key}
              className="card-carousel-slide"
              /* Kartu yang tidak tampil dimatikan seluruhnya: tidak bisa ditekan, tidak jadi perhentian Tab, tidak dibacakan. `aria-hidden` saja tidak cukup — ia menyembunyikan dari pembaca layar tapi tombolnya masih bisa difokus, jadi Tab berhenti di tombol yang tak terlihat oleh siapa pun. */
              inert={index !== active}
            >
              {item.node}
            </div>
          ))}
        </div>
      </div>

      {/* Titik penunjuk sekaligus tombolnya. Bukan cuma indikator: kartu yang bergantian sendiri harus bisa DIPANGGIL kembali, karena kartu yang baru saja terlewat tidak punya jalan lain untuk kembali selain menunggu satu putaran penuh. */}
      <div className="card-carousel-dots">
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSlide(index)}
            aria-current={index === active ? 'true' : undefined}
            aria-label={item.label}
            className="focus-ring transition-ui card-carousel-dot"
          />
        ))}
      </div>
    </div>
  )
}

/** Geseran jempol. Ditulis dengan pointer event mentah alih-alih `scroll-snap` seperti `CardRail`: trek di sini digerakkan `translate` dari state, dan wadah yang bisa digulir sendiri berarti ada DUA sumber posisi yang harus dijaga sama — yang satu diubah rotasi otomatis, yang satu diubah jempol. Tidak memakai pointer capture, dan itu disengaja: kartunya berisi tombol, dan menangkap pointer di wadahnya membuat tekan biasa di atas tombol tidak pernah sampai ke tombolnya. Yang dilakukan di sini hanya MEMBACA jaraknya lalu memutuskan di akhir. */
function useSwipe({
  count,
  setSlide,
}: {
  count: number
  setSlide: (next: (current: number) => number) => void
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (count < 2) return
      start.current = { x: event.clientX, y: event.clientY }
    },
    [count],
  )

  useEffect(() => {
    const el = viewportRef.current
    if (!el || count < 2) return

    const finish = (event: PointerEvent) => {
      const from = start.current
      start.current = null
      if (!from) return

      const dx = event.clientX - from.x
      // Gulir tegak halaman menang. Tanpa syarat ini, menggulir beranda dengan
      // jempol yang sedikit melenceng menyamping ikut memindahkan kartunya.
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(event.clientY - from.y)) return

      // Tidak berputar di ujung: swipe adalah gerak berarah, dan kartu pertama
      // yang melompat ke kartu terakhir saat digeser ke kanan terbaca sebagai
      // salah geser. Rotasi otomatis yang berputar — di sana tidak ada tangan
      // yang menyatakan arah.
      const step = dx < 0 ? 1 : -1
      setSlide((current) => Math.min(Math.max(current + step, 0), count - 1))
    }

    // Jempol yang keluar dari wadahnya, atau gestur yang diambil alih peramban:
    // tanpa ini, `start` tertinggal dan tekan berikutnya diukur dari titik lama.
    const abort = () => {
      start.current = null
    }

    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', abort)

    return () => {
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', abort)
    }
  }, [count, setSlide])

  return { viewportRef, onPointerDown }
}
