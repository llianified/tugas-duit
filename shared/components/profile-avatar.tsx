'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { CosmeticKey } from '@/domain/store/cosmetics'
import { GlyphUser } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

/** Warna bingkai kosmetik. Tinggal di sini, bukan di `domain/store/cosmetics.ts`, karena gradien
 * adalah penyajian — katalog di sana cuma tahu nama dan jenis barangnya.
 *
 * Nilainya gradien inline, bukan kelas Tailwind. Kelas yang dirakit dari key (`bg-${key}`) tidak
 * ikut terpindai dan akan hilang dari CSS produksi tanpa satu pun error; yang terlihat cuma bingkai
 * yang dibayar user tapi tidak pernah muncul. Peta ini juga sengaja tidak lengkap — gelar tidak
 * punya bingkai — jadi bacaannya boleh `undefined`, dan `undefined` berarti tidak menggambar apa
 * pun. */
const FRAME_GRADIENT: Partial<Record<CosmeticKey, string>> = {
  frame_emas: 'linear-gradient(135deg,#ffe9a8,#d4a017 45%,#fff3c4)',
  frame_langit: 'linear-gradient(135deg,#7dd3fc,#6366f1 55%,#c084fc)',
  frame_api: 'linear-gradient(135deg,#fbbf24,#ef4444 60%,#fb923c)',
  frame_zamrud: 'linear-gradient(135deg,#6ee7b7,#047857 55%,#a7f3d0)',
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
  const gradient = frame ? FRAME_GRADIENT[frame] : undefined

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
  if (!gradient) {
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
      className={cn('flex shrink-0 items-center justify-center rounded-full p-[2px]', className)}
      style={{ backgroundImage: gradient }}
    >
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
        {inner}
      </span>
    </span>
  )
}
