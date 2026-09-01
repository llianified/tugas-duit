'use client'

import type { ReactNode } from 'react'
import { splitAmountParts } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const CREDIT_SIZE_CLASS = {
  sm: 'flex-row items-baseline gap-1 text-sm font-semibold',
  xl: 'flex-col items-stretch gap-1.5 text-4xl font-bold leading-none tracking-[-0.03em]',
  '2xl': 'flex-row flex-wrap items-baseline gap-x-2 text-5xl font-bold leading-none tracking-[-0.035em]',
  /* Angka hero tidak boleh terlipat: nominal dan unitnya satu tarikan
     ("3.646 credit"), bukan "3.646" lalu "credit" di bawahnya. Karena itu
     `whitespace-nowrap` dan tanpa `flex-wrap` — kalau ruangnya sempit yang
     mengalah adalah UKURAN hurufnya, bukan barisnya. Ukuran itu dihitung di
     `heroFontSize()`; di sini sengaja tidak ada `text-*` supaya tidak ada dua
     sumber kebenaran soal ukuran. */
  display: 'num-display flex-row items-baseline gap-x-1.5 whitespace-nowrap',
} as const

const CREDIT_STACKED = { sm: false, xl: true, '2xl': false, display: false } as const

/*
 * Lebar bagian-bagian angka hero, hasil UKUR di browser (bukan terkaan) pada
 * font display yang dipakai sekarang. Semuanya relatif ukuran huruf (em),
 * kecuali `HERO_FIXED_PX` yang memang tidak ikut mengecil.
 */
const HERO_DIGIT_EM = 0.571 // satu angka
const HERO_SEPARATOR_EM = 0.375 // titik ribuan / koma — lebih sempit dari angka
const HERO_UNIT_EM = 1.78 // tulisan " credit"
const HERO_FIXED_PX = 34 // ikon hint (ukurannya tetap) + gap + sisa aman

/**
 * Ukuran angka hero, dihitung dari ruang yang benar-benar tersedia.
 *
 * Dua hal menentukan apakah "3.646 credit" masih muat satu baris: lebar
 * kolomnya dan panjang nominalnya.
 *
 * Untuk yang pertama, satuan viewport tidak bisa dipakai — shell aplikasi ini
 * dikunci `max-w-md`, jadi di layar lebar `vw` terus tumbuh sementara kolomnya
 * diam di tempat, dan angkanya malah kebesaran saat layarnya lega. Patokannya
 * `cqi`: 100cqi = lebar kolom hero itu sendiri, berapa pun jendelanya.
 *
 * Untuk yang kedua, nominal dipecah jadi angka dan pemisah karena keduanya
 * tidak sama lebar. Dari situ ketemu lebar yang dibutuhkan per satu satuan
 * ukuran huruf, dan ukuran huruf terbesar yang masih muat adalah
 * (lebar kolom − bagian yang tak mengecil) ÷ lebar-per-em itu.
 *
 * Hasilnya: saldo pendek tetap tampil besar, saldo panjang mengecil sendiri —
 * dan tidak ada nominal yang memaksa "credit" turun ke baris berikutnya.
 */
function heroFontSize(text: string) {
  const digits = text.replace(/\D/g, '').length
  const separators = text.length - digits
  const widthPerEm =
    HERO_DIGIT_EM * digits + HERO_SEPARATOR_EM * separators + HERO_UNIT_EM

  return `clamp(1.25rem, calc((100cqi - ${HERO_FIXED_PX}px) / ${widthPerEm.toFixed(3)}), 3rem)`
}

const CREDIT_UNIT_CLASS = {
  sm: 'text-xs font-medium',
  xl: 'text-sm font-medium',
  '2xl': 'text-sm font-semibold',
  display: 'text-[0.6em] font-extrabold',
} as const

export function CreditAmount({
  value,
  prefix,
  unit = 'credit',
  hint,
  size = 'sm',
  tone = 'primary',
  className,
}: {
  value: string
  prefix?: string
  unit?: string
  hint?: ReactNode
  size?: 'sm' | 'xl' | '2xl' | 'display'
  tone?: 'primary' | 'neutral'
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex tabular-nums',
        tone === 'primary' ? 'text-primary' : 'text-foreground',
        CREDIT_SIZE_CLASS[size],
        className,
      )}
      style={size === 'display' ? { fontSize: heroFontSize(`${prefix ?? ''}${value}`) } : undefined}
    >
      {size === 'display' ? (
        <DisplayValue prefix={prefix} value={value} />
      ) : CREDIT_STACKED[size] ? (
        <span>
          {prefix}
          {value}
        </span>
      ) : (
        <>
          {prefix}
          {value}{' '}
        </>
      )}
      <span className={cn(CREDIT_UNIT_CLASS[size], 'tracking-normal text-muted-foreground')}>
        {unit}
        {hint}
      </span>
    </span>
  )
}

/**
 * Angka besar gaya fomo: bagian bulatnya penuh terang, sisanya diredam.
 *
 * Yang diredam hanya tanda/simbol di depan dan desimal di belakang — bukan
 * pemisah ribuan, karena di format Indonesia titik itu bagian dari bilangan
 * bulat. Kalau nilainya bulat, tidak ada `,00` yang dipaksa muncul; bagian
 * `trail` cuma kosong.
 */
function DisplayValue({ prefix, value }: { prefix?: string; value: string }) {
  const { lead, main, trail } = splitAmountParts(`${prefix ?? ''}${value}`)

  return (
    <span>
      {lead ? <span className="text-[0.6em] text-muted-foreground">{lead}</span> : null}
      {main}
      {trail ? <span className="text-[0.6em] text-muted-foreground">{trail}</span> : null}
    </span>
  )
}
