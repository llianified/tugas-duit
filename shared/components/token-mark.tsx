import { cn } from '@/shared/lib/utils'

/** Lambang TD di sebelah nominal. Ia TIDAK tinggal di `glyph.tsx`: seisi berkas itu ikon garis
 * Tabler yang dirender `GlyphSvg` dengan `stroke="currentColor"` dan `strokeWidth` seragam,
 * sedangkan ini mark isi dengan lubang — menumpangkannya berarti memberi `GlyphSvg` satu cabang
 * khusus untuk satu pemakai.
 *
 * Monokrom dan mengikuti `currentColor`, bukan dua warna brand. Aplikasi ini gelap-saja
 * (`--background: #101014`), jadi bagian hitam logo aslinya akan hilang di latar, dan birunya
 * (≈`#5b4bff`) hampir sama dengan `--primary` sehingga ikut lenyap begitu mark-nya duduk di atas
 * bidang aksen. Mengikuti warna teks membuatnya aman di ketiga tempat: angka biru, teks putih,
 * dan di dalam tombol.
 *
 * Ukurannya relatif (`em`), bukan tetap: itu satu-satunya cara ia tetap seimbang di hero beranda,
 * yang ukuran hurufnya dihitung dari lebar kolom dan berubah mengikuti panjang saldo. Angkanya
 * 0,82em, bukan 1em — kotak em sebuah huruf lebih tinggi daripada angkanya sendiri (tinggi digit
 * ≈0,7em), jadi mark setinggi 1em akan menjulang di atas deretan angka yang ia dampingi.
 *
 * `fill-rule="evenodd"` mengerjakan seluruh bentuknya dalam satu path: segitiga luar terisi,
 * segitiga tengah melubanginya, segitiga kecil di dalam lubang terisi lagi karena berada di
 * silangan ketiga. */
export function TokenMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('size-[0.82em] shrink-0 self-center', className)}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2.4 23 21.6H1L12 2.4ZM12 9.2 6.2 21.6h11.6L12 9.2ZM12 13.4l4.3 8.2H7.7l4.3-8.2Z"
      />
    </svg>
  )
}
