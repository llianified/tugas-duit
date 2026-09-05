'use client'

import type { ReactNode } from 'react'
import { splitAmountParts, TOKEN_SYMBOL } from '@/shared/lib/format'
import { TokenMark } from '@/shared/components/token-mark'
import { cn } from '@/shared/lib/utils'

const CREDIT_SIZE_CLASS = {
  sm: 'flex-row items-baseline gap-1 text-sm font-semibold',
  xl: 'flex-col items-stretch gap-1.5 text-4xl font-bold leading-none tracking-[-0.03em]',
  '2xl': 'flex-row flex-wrap items-baseline gap-x-2 text-5xl font-bold leading-none tracking-[-0.035em]',
  /* Angka hero tidak boleh terlipat: nominal dan unitnya satu tarikan ("3.646 TD"), bukan "3.646" lalu "TD" di bawahnya. Karena itu `whitespace-nowrap` dan tanpa `flex-wrap` — kalau ruangnya sempit yang mengalah adalah UKURAN hurufnya, bukan barisnya. Ukuran itu dihitung di `heroFontSize()`; di sini sengaja tidak ada `text-*` supaya tidak ada dua sumber kebenaran soal ukuran. */
  display: 'num-display flex-row items-baseline gap-x-1.5 whitespace-nowrap',
} as const

const CREDIT_STACKED = { sm: false, xl: true, '2xl': false, display: false } as const

/* * Lebar bagian-bagian angka hero, hasil UKUR di browser (bukan terkaan) pada * font display yang dipakai sekarang. Semuanya relatif ukuran huruf (em), * kecuali `HERO_FIXED_PX` yang memang tidak ikut mengecil. */
const HERO_DIGIT_EM = 0.571 // satu angka
const HERO_SEPARATOR_EM = 0.375 // titik ribuan / koma — lebih sempit dari angka
/* Mark TD justru IKUT mengecil: ukurannya relatif terhadap nominal, jadi ia masuk ke lebar-per-em, bukan ke bagian tetap. Kalau ia dipatok px seperti satuannya, saldo panjang akan mengecilkan angkanya sampai mark-nya jadi lebih tinggi daripada digit di sebelahnya. */
const HERO_MARK_EM = 0.82 // sama dengan `size-[0.82em]` di `TokenMark`
/* Satuan TIDAK ikut mengecil bersama nominalnya: ukurannya dipatok `text-sm` sama seperti hero referral, jadi lebarnya konstan dan masuk ke bagian tetap di bawah. Angka ini turun dari 76 ke 60 saat satuannya berganti dari "credit" (≈42px) ke "TD" (≈20px); +6px-nya jarak tambahan untuk mark di depan nominal, yang jaraknya tetap sementara mark-nya sendiri tidak. */
const HERO_FIXED_PX = 60 // satuan + ikon hint (ukurannya tetap) + dua gap + sisa aman

/** Ukuran angka hero, dihitung dari ruang yang benar-benar tersedia. Dua hal menentukan apakah "3.646 TD" masih muat satu baris: lebar kolomnya dan panjang nominalnya. Untuk yang pertama, satuan viewport tidak bisa dipakai — shell aplikasi ini dikunci `max-w-md`, jadi di layar lebar `vw` terus tumbuh sementara kolomnya diam di tempat, dan angkanya malah kebesaran saat layarnya lega. Patokannya `cqi`: 100cqi = lebar kolom hero itu sendiri, berapa pun jendelanya. Untuk yang kedua, nominal dipecah jadi angka dan pemisah karena keduanya tidak sama lebar. Dari situ ketemu lebar yang dibutuhkan per satu satuan ukuran huruf, dan ukuran huruf terbesar yang masih muat adalah (lebar kolom − bagian yang tak mengecil) ÷ lebar-per-em itu. Batas 1,875rem menyisakan 6px untuk jarak dan 14px untuk baris pendukung, sehingga seluruh blok kiri maksimal 50px dan tidak melampaui CTA 52px. Hasilnya: saldo pendek tetap tampil menonjol, saldo panjang mengecil sendiri, dan tidak ada nominal yang memaksa satuannya turun ke baris berikutnya. */
function heroFontSize(text: string) {
  const digits = text.replace(/\D/g, '').length
  const separators = text.length - digits
  const widthPerEm = HERO_DIGIT_EM * digits + HERO_SEPARATOR_EM * separators + HERO_MARK_EM

  return `clamp(1.25rem, calc((100cqi - ${HERO_FIXED_PX}px) / ${widthPerEm.toFixed(3)}), 1.875rem)`
}

const CREDIT_UNIT_CLASS = {
  sm: 'text-xs font-medium',
  xl: 'text-sm font-medium',
  '2xl': 'text-sm font-semibold',
  /* Sama seperti hero referral (`2xl`): satuannya keterangan, bukan bagian dari angkanya. Nilai relatif (`0.6em` dari nominal ~43px) membuat satuannya tumbuh jadi ~26px — hampir sebesar nominal `2xl` itu sendiri — dan bobot `extrabold` menyeret mata ke kata yang paling sedikit isinya. */
  display: 'text-sm font-semibold',
} as const

export function CreditAmount({
  value,
  prefix,
  unit = TOKEN_SYMBOL,
  hint,
  size = 'sm',
  tone = 'primary',
  measure,
  className,
}: {
  value: string
  prefix?: string
  unit?: string
  hint?: ReactNode
  size?: 'sm' | 'xl' | '2xl' | 'display'
  tone?: 'primary' | 'neutral'
  /** Teks yang dipakai MENGUKUR, kalau berbeda dari yang ditampilkan. Angka hero dianimasikan naik frame demi frame, jadi `value` sesaat lebih pendek dari nilai akhirnya — dan karena ukuran huruf dihitung dari jumlah digit, angkanya akan mengecil satu tingkat tepat saat melewati 999 → 1.000, di tengah animasi. Diukur dari nilai akhir, ukurannya sudah benar sejak frame pertama dan tidak bergerak lagi. */
  measure?: string
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
      style={
        size === 'display'
          ? { fontSize: heroFontSize(`${prefix ?? ''}${measure ?? value}`) }
          : undefined
      }
    >
      {/* Mark selalu di depan nominal, termasuk pada tata letak bertumpuk (`xl`) — di sana induknya
          `flex-col`, jadi mark dan angkanya harus dibungkus satu baris sendiri supaya mark tidak
          jatuh jadi barisnya sendiri di atas angka. */}
      {size === 'display' ? (
        <>
          <TokenMark />
          <DisplayValue prefix={prefix} value={value} />
        </>
      ) : CREDIT_STACKED[size] ? (
        <span className="flex items-center gap-[0.2em]">
          <TokenMark />
          <span>
            {prefix}
            {value}
          </span>
        </span>
      ) : (
        <>
          <TokenMark />
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

/** Angka besar gaya fomo: bagian bulatnya penuh terang, sisanya diredam. Yang diredam hanya tanda/simbol di depan dan desimal di belakang — bukan pemisah ribuan, karena di format Indonesia titik itu bagian dari bilangan bulat. Kalau nilainya bulat, tidak ada `,00` yang dipaksa muncul; bagian `trail` cuma kosong. */
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
