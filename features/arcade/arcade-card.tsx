'use client'

import { GlyphChevron, GlyphPlay } from '@/shared/components/glyph'
import { hapticTap } from '@/shared/lib/haptic'

/** Pintu masuk Arena di Beranda. Ia BUKAN tombol yang berpura-pura mempercepat stok — itu yang ditolak keputusan di `ActiveTask`, dan alasannya tetap berlaku. Yang ditawarkan di sini tujuan lain: satu tempat yang hadiahnya justru mengisi stok itu. Bedanya nyata di data, bukan cuma di kata-kata, karena hadiah isi stok memang menambah kapasitas yang bisa dikerjakan hari itu. | Kalimatnya berubah saat stok habis karena di situlah kartu ini paling berguna; di luar itu ia tetap ada, sesuai keputusan bahwa Arena boleh dimainkan kapan saja selama jatah hariannya masih ada. */
export function ArcadeCard({
  poolEmpty,
  onOpen,
}: {
  poolEmpty: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        hapticTap()
        onOpen()
      }}
      aria-label="Buka Arena, pilih permainan dan menangkan energi atau isi stok reward"
      className="focus-ring transition-ui press-scale-soft group flex w-full text-left"
    >
      <span className="stamp stamp-card stamp-primary min-w-0 flex-1">
        <span className="stamp-card-head flex items-start justify-between gap-3">
          <span className="home-tag stamp-tag pt-1">Arena</span>
          <span className="flex flex-col items-end gap-1">
            <span className="num-display stamp-ink-fg text-[1.375rem]">2</span>
            <span className="home-tag">game</span>
          </span>
        </span>

        <span className="stamp-card-lead stack-gap-t flex items-center gap-2">
          <span className="stamp-portrait">
            <GlyphPlay className="stamp-ink-fg size-4" />
          </span>
          <span className="text-sm font-semibold leading-snug text-foreground">
            Main, menang, lanjut ngerjain soal.
          </span>
        </span>

        <span className="stamp-card-detail stack-gap-t block text-xs leading-snug text-muted-foreground text-pretty">
          {poolEmpty
            ? 'Stok habis? Menangkan isi stok tanpa perlu menunggu.'
            : 'Pilih kotak atau cocokkan kartu buat menang energi dan isi stok.'}
        </span>

        <span className="stamp-card-foot stamp-foot flex items-center justify-between gap-2">
          <span className="text-[11px] leading-snug text-muted-foreground">
            Pilih permainanmu
          </span>
          <span className="flex items-center gap-1 text-xs font-bold stamp-ink-fg">
            Buka Arena
            <GlyphChevron className="size-4 shrink-0 transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </span>
      </span>
    </button>
  )
}
