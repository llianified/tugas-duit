'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { CosmeticKey } from '@/domain/store/cosmetics'
import { GlyphUser } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

interface FrameSkin {
  gradient: string
  /** Kelas animasinya di `app/globals.css`. Ditulis utuh sebagai literal, bukan dirakit dari key —
   * alasan yang sama dengan gradiennya, lihat catatan di bawah. */
  motion: string
  /** Warna cahaya yang berdenyut di luar cincin, dibaca `@keyframes cos-frame-flicker` lewat
   * `--cos-frame-glow`. Kosong berarti bingkainya cuma bergeser tanpa menyala. */
  glow?: string
}

/** Rupa bingkai kosmetik. Tinggal di sini, bukan di `domain/store/cosmetics.ts`, karena warna dan
 * gerak adalah penyajian — katalog di sana cuma tahu nama dan jenis barangnya.
 *
 * Nilainya gradien inline, bukan kelas Tailwind. Kelas yang dirakit dari key (`bg-${key}`) tidak
 * ikut terpindai dan akan hilang dari CSS produksi tanpa satu pun error; yang terlihat cuma bingkai
 * yang dibayar user tapi tidak pernah muncul. Peta ini juga sengaja tidak lengkap — gelar tidak
 * punya bingkai — jadi bacaannya boleh `undefined`, dan `undefined` berarti tidak menggambar apa
 * pun.
 *
 * Gerakannya bukan hiasan: cincin setebal 2px yang diam nyaris tidak terbaca sebagai barang
 * berbayar, dan bingkai adalah satu-satunya barang di rak yang tidak memberi satu credit pun —
 * penampakannya memang seluruh nilainya. */
const FRAME_SKIN: Partial<Record<CosmeticKey, FrameSkin>> = {
  frame_emas: {
    gradient: 'linear-gradient(135deg,#ffe9a8,#d4a017 45%,#fff3c4)',
    motion: 'cos-frame-emas',
  },
  frame_langit: {
    gradient: 'linear-gradient(135deg,#7dd3fc,#6366f1 55%,#c084fc)',
    motion: 'cos-frame-langit',
  },
  frame_api: {
    gradient: 'linear-gradient(135deg,#fbbf24,#ef4444 60%,#fb923c)',
    motion: 'cos-frame-api',
    glow: 'color-mix(in oklab,#fb923c 60%,transparent)',
  },
  frame_zamrud: {
    gradient: 'linear-gradient(135deg,#6ee7b7,#047857 55%,#a7f3d0)',
    motion: 'cos-frame-zamrud',
  },
}

export function ProfileAvatar({
  photoUrl,
  className,
  glyphClassName,
  frame = null,
}: {
  photoUrl: string | null
  className?: string
  glyphClassName?: string
  /** Bingkai yang sedang dipakai pemilik foto ini. `null` — dan itu keadaan bawaan hampir semua
   * orang — merender persis seperti sebelum kosmetik ada, tanpa satu elemen tambahan pun. */
  frame?: CosmeticKey | null
}) {
  const [photoBroken, setPhotoBroken] = useState(false)

  useEffect(() => {
    setPhotoBroken(false)
  }, [photoUrl])

  const showPhoto = photoUrl !== null && !photoBroken
  const skin = frame ? FRAME_SKIN[frame] : undefined

  const inner: ReactNode = showPhoto ? (
    // URL avatar provider arbitrer perlu fallback langsung saat CDN gagal.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setPhotoBroken(true)}
      className="size-full object-cover"
    />
  ) : (
    <GlyphUser className={cn('size-4', glyphClassName)} />
  )

  /** Bingkainya padding berwarna, bukan `border` maupun `ring`. Keduanya menggambar di luar kotak
   * elemen, jadi avatar berbingkai akan lebih besar daripada tetangganya di baris papan peringkat
   * dan barisnya ikut bergeser. Padding menggambar ke dalam: ukuran luarnya tetap persis sama
   * dengan yang diminta `className`, dan yang mengecil fotonya. */
  if (!skin) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground',
          className,
        )}
      >
        {inner}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'cos-frame flex shrink-0 items-center justify-center rounded-full p-[2px]',
        skin.motion,
        className,
      )}
      style={{ backgroundImage: skin.gradient, '--cos-frame-glow': skin.glow } as CSSProperties}
    >
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
        {inner}
      </span>
    </span>
  )
}
