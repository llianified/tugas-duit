'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** Dasar chip padat gaya fomo: radius `--chip-radius`, padding ketat, teks 0.6875rem/700. Diekspor supaya elemen yang bukan `MetaBadge` (mis. `DifficultyBadge`) tetap memakai geometri yang sama. */
export const CHIP_SHAPE = 'chip'

export type ChipTone = 'muted' | 'neutral' | 'primary' | 'success' | 'destructive' | 'premium'

const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  muted: 'chip-muted',
  neutral: 'chip-neutral',
  primary: 'chip-primary',
  success: 'chip-success',
  destructive: 'chip-destructive',
  premium: 'chip-premium',
}

export function MetaBadge({
  children,
  tone = 'muted',
  className,
  detail,
}: {
  children: ReactNode
  className?: string
  tone?: ChipTone
  /** Penjelasan panjang saat chip-nya sendiri terlalu pendek (mis. lencana prestise di papan peringkat). Dulu ini `title=`, yang di WebView Telegram tidak pernah bisa dibuka: tidak ada hover, dan `<span>` non-fokusabel tidak terjangkau papan tombol. Sekarang ia teks sungguhan yang hanya disembunyikan secara visual, jadi pembaca layar membacanya bersama label chip-nya. Di baris papan yang lebarnya ~200px memang tidak ada ruang untuk popover per chip; keterangan yang sama bisa diketuk di halaman Profil, tempat lencana ini juga tampil. */
  detail?: string
}) {
  return (
    <span className={cn(CHIP_SHAPE, 'shrink-0 tabular-nums', CHIP_TONE_CLASS[tone], className)}>
      {children}
      {detail ? <span className="sr-only"> — {detail}</span> : null}
    </span>
  )
}
