'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { GlyphBolt } from '@/shared/components/glyph'
import { formatCredits } from '@/shared/lib/format'

/** Seluruh pertunjukan dari muncul sampai habis. Tap membubarkannya lebih cepat — misi harian
 * diklaim beberapa kali sehari, dan animasi yang tidak bisa dilewati berubah jadi pajak. */
const REVEAL_MS = 2_000

/** Bingkisan yang dibuka saat hadiah misi diambil.
 *
 * Ia menggantikan bar progres yang dulu ada di tiap baris misi dan dilepas demi kebersihan daftar.
 * Pertukarannya disengaja: daftar misi tetap sunyi — cuma judul dan hadiahnya — dan seluruh
 * perayaannya dipindah ke SATU momen, yaitu detik hadiahnya diambil.
 *
 * Bentuknya KERTAS, bukan kotak kado mengilap. Seisi aplikasi ini benda kertas — karcis bersudut
 * gunting, perangko bergigi perforasi — dan kotak bervolume akan berdiri sebagai satu-satunya benda
 * dari dunia lain.
 *
 * Urutannya BERGANTIAN, bukan bertumpuk: bingkisan muncul, bergoyang, lalu PERGI SELURUHNYA —
 * tutupnya terbang, badannya menyusut hilang — dan angkanya baru masuk setelah panggungnya kosong.
 * Versi pertama menaikkan angka dari dalam kotak yang masih berdiri, dan dua benda yang bergerak
 * di tempat yang sama pada saat yang sama membuat keduanya tidak terbaca.
 *
 * Dipasang lewat portal ke `document.body`, dan itu bukan selera: kartu misi hidup di dalam
 * pembungkus transisi view yang membawa `transform`, dan ancestor ber-transform membuat
 * `position: fixed` diukur dari ancestor itu, bukan dari viewport. */
export function RewardReveal({ amount, onDone }: { amount: number; onDone: () => void }) {
  /** Portal baru boleh dipasang setelah komponennya hidup di browser; `document` tidak ada saat
   * render di server. */
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const timer = setTimeout(onDone, REVEAL_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  if (!mounted) return null

  return createPortal(
    <div
      className="gift-layer"
      role="status"
      aria-label={`Dapat ${formatCredits(amount)} energi`}
      onClick={onDone}
    >
      <div className="gift-stage" aria-hidden="true">
        {/* `overflow: visible` di CSS-nya wajib: tutupnya terbang keluar batas viewBox, dan SVG
            memangkas isinya di batas itu secara bawaan — tanpa itu tutupnya terpotong rata persis
            saat ia paling terlihat. */}
        <svg viewBox="0 0 120 120" className="gift-parcel" xmlns="http://www.w3.org/2000/svg">
          {/* Badan lebih dulu supaya tutup menimpanya di seam; SVG tidak mengenal z-index. */}
          <g className="gift-body">
            <rect
              x="27"
              y="57"
              width="66"
              height="44"
              rx="4"
              fill="var(--gift-paper)"
              stroke="var(--gift-edge)"
              strokeWidth="2.5"
            />
            <rect x="54" y="57" width="12" height="44" fill="var(--gift-ribbon)" />
          </g>

          <g className="gift-lid">
            <rect
              x="21"
              y="41"
              width="78"
              height="18"
              rx="3.5"
              fill="var(--gift-paper)"
              stroke="var(--gift-edge)"
              strokeWidth="2.5"
            />
            <rect x="54" y="42" width="12" height="16" fill="var(--gift-ribbon)" />
            {/* Simpul pita: dua daun yang berangkat dari titik ikat dan melengkung balik ke sana.
                Bentuk daun dipakai, bukan elips miring — elips tidak punya ujung runcing di titik
                ikat, jadi pitanya terbaca sebagai dua gumpalan yang kebetulan menempel.
                Daunnya dibuat MELEBAR, bukan menjulang: versi pertama mendorong ujungnya ke atas
                sejauh ia mendorong ke samping, dan hasilnya terbaca sebagai sepasang telinga.
                Pita sungguhan melebar ke samping dan cuma sedikit naik. */}
            <path
              d="M60 41 C 45 42, 32 37, 33 30 C 34 24, 51 30, 60 41 Z"
              fill="var(--gift-ribbon)"
            />
            <path
              d="M60 41 C 75 42, 88 37, 87 30 C 86 24, 69 30, 60 41 Z"
              fill="var(--gift-ribbon)"
            />
            <circle cx="60" cy="40" r="5" fill="var(--gift-ribbon)" />
          </g>
        </svg>

        <span className="gift-reward">
          <GlyphBolt className="size-6" />+{formatCredits(amount)}
        </span>
      </div>
    </div>,
    document.body,
  )
}
