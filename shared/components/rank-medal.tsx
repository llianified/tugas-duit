import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/**
 * Penanda peringkat ala fomo: tiga teratas memakai **pita** (bidang padat
 * dengan ujung bawah bercelah), sisanya angka biasa berimbuh titik.
 *
 * Kenapa bentuknya pita dan bukan lingkaran bernomor seperti sebelumnya: pada
 * lebar 384px podium harus terbaca dalam satu lirikan, dan siluet yang berbeda
 * mengerjakan itu lebih cepat daripada tiga lingkaran identik yang hanya beda
 * warna. Warnanya tetap membedakan 1/2/3 karena jarak antar podium justru yang
 * paling diperebutkan.
 *
 * Emas di sini TIDAK memakai `--premium`. Premium sudah memakai emas di cincin
 * avatar dan mahkota; memakai token yang sama untuk dua hal berbeda membuat
 * baris papan tidak bisa dibaca. Karena itu `--medal-*` berdiri sendiri, dengan
 * pasangan terang & gelap di `globals.css`.
 *
 * Angkanya adalah teks nyata, jadi pembaca layar tetap mendengar peringkatnya;
 * hanya bidang pitanya yang `aria-hidden`.
 */
export type RankMedalSize = 'sm' | 'md'

/** Latar pita dipisah dari warna teksnya karena keduanya dipasang di elemen
 * berbeda: bidang pita yang terpotong `clip-path`, dan angkanya di atasnya. */
const MEDAL_BG: Record<number, string> = {
  1: 'bg-medal-gold',
  2: 'bg-medal-silver',
  3: 'bg-medal-bronze',
}

const MEDAL_FG: Record<number, string> = {
  1: 'text-medal-gold-fg',
  2: 'text-medal-silver-fg',
  3: 'text-medal-bronze-fg',
}

const MEDAL_BOX: Record<RankMedalSize, string> = {
  sm: 'h-4 w-3.5 text-[10px]',
  md: 'h-5 w-4 text-[11px]',
}

const PLAIN_TEXT: Record<RankMedalSize, string> = {
  sm: 'text-[10px]',
  md: 'text-[11px]',
}

/** Kontur pemisah dipakai saat pitanya ditumpuk di atas gambar (mis. sudut
 * avatar di papan peringkat), tempat warna di bawahnya tidak bisa ditebak.
 * `shadow`/`ring` tidak bisa dipakai di sini karena keduanya mengikuti kotak,
 * bukan siluet ber-notch, jadi konturnya digambar sebagai pita kedua yang
 * sedikit lebih besar dengan clip-path yang sama. */
const HALO_TONE = {
  background: 'bg-background',
  card: 'bg-card',
} as const

export type RankMedalHalo = keyof typeof HALO_TONE

export function RankMedal({
  position,
  size = 'md',
  halo,
  className,
}: {
  position: number
  size?: RankMedalSize
  halo?: RankMedalHalo
  className?: string
}) {
  // Posisi bisa datang dari data (`0`, `NaN`, negatif kalau papannya belum
  // terisi), jadi apa pun di luar 1–3 jatuh ke angka biasa daripada merender
  // pita tanpa warna.
  const background = Number.isFinite(position) ? MEDAL_BG[position] : undefined

  if (background === undefined) {
    return (
      <span
        className={cn(
          'font-bold tabular-nums text-muted-foreground',
          PLAIN_TEXT[size],
          className,
        )}
      >
        {Number.isFinite(position) && position > 0 ? `${formatCredits(position)}.` : '–'}
      </span>
    )
  }

  return (
    <span className={cn('relative inline-flex shrink-0', MEDAL_BOX[size], className)}>
      {/* Celah "V" di sisi bawah dibuat lewat clip-path, bukan dua segitiga
          tambahan: satu elemen lebih murah dan tidak bisa bergeser sendiri saat
          ukurannya diubah. Radius atas tetap berlaku karena clip-path memotong
          kotak yang sudah dibulatkan. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 rounded-t-[0.3125rem] rounded-b-[0.125rem]',
          '[clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]',
          background,
        )}
      />
      <span
        className={cn(
          'relative flex w-full items-center justify-center pb-1 font-bold tabular-nums leading-none',
          MEDAL_FG[position],
        )}
      >
        {formatCredits(position)}
      </span>
    </span>
  )
}
