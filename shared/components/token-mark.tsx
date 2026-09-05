import { cn } from '@/shared/lib/utils'

/** Lambang TD di sebelah nominal. Ia TIDAK tinggal di `glyph.tsx`: seisi berkas itu ikon garis
 * Tabler yang dirender `GlyphSvg` dengan `stroke="currentColor"` dan `strokeWidth` seragam,
 * sedangkan ini mark isi dengan lubang — menumpangkannya berarti memberi `GlyphSvg` satu cabang
 * khusus untuk satu pemakai.
 *
 * Monokrom dan mengikuti `currentColor`, bukan dua warna aslinya. Aplikasi ini gelap-saja
 * (`--background: #101014`), jadi huruf A yang aslinya `#151515` praktis hilang di latar, dan
 * segitiga `#4A3AF7` lenyap begitu mark-nya duduk di atas bidang `--primary` (`#4f56f2`) — dua
 * warna yang di kertas putih saling memisahkan, di sini justru saling menghapus. Mengikuti warna
 * teks membuatnya aman di ketiganya: angka biru, teks putih, dan di dalam tombol.
 *
 * `viewBox` dipotong ke kotak gambarnya sendiri, bukan `0 0 1536 1536` bawaan berkas aslinya: di
 * kotak itu gambarnya cuma mengisi 62% lebar dan 43% tinggi, jadi mark 11px akan menggambar huruf
 * setinggi 5px dengan sisanya udara. Ukurannya lalu dipatok dari TINGGI (0,72em, setinggi angka di
 * sebelahnya) dengan lebar mengikuti rasio aslinya 1,428 — bukan kotak persegi, karena marknya
 * memang lebih lebar daripada tinggi.
 *
 * Celah antara huruf dan segitiga di dalamnya 11,6% dari lebar mark, jadi di ukuran inline (~11px)
 * ia tinggal 1,3px dan kedua bidang mulai menyatu jadi satu siluet. Itu diterima: pada ukuran itu
 * detail apa pun hilang, dan yang perlu terbaca cuma bentuk A-nya. Celahnya kembali jelas di
 * nominal besar — hero beranda dan papan tombol penarikan. */
export function TokenMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="292 432 951 666"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('h-[0.72em] w-[1.03em] shrink-0 self-center', className)}
    >
      <path
        fill="currentColor"
        d="M292 1096 L668 440 Q674 432 682 432 L849 432 Q858 432 864 440 L1243 1098 L1049 1096 L769 609 Q765 602 760 609 L485 1098 Z"
      />
      <path fill="currentColor" d="M767 798 L939 1098 L596 1098 Z" />
    </svg>
  )
}
