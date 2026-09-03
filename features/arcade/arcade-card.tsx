'use client'

import { GlyphChevron, GlyphPlay } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { MetaBadge } from '@/shared/components/meta-badge'
import { SURFACE_CARD_CLASS } from '@/shared/components/surface-card'
import { hapticTap } from '@/shared/lib/haptic'
import { cn } from '@/shared/lib/utils'

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
      className={cn(
        SURFACE_CARD_CLASS,
        'focus-ring transition-ui press-scale-soft group flex w-full flex-col gap-3 text-left',
        poolEmpty && 'bg-primary/[0.08] ring-1 ring-primary/45',
      )}
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <IconCircle tone={poolEmpty ? 'primary' : 'muted'}>
            <GlyphPlay className="size-4" />
          </IconCircle>
          <span className="min-w-0">
            <span className="block text-base font-bold tracking-tight text-foreground">Arena</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">Main, menang, lanjut.</span>
          </span>
        </span>
        <MetaBadge tone={poolEmpty ? 'primary' : 'muted'}>2 game</MetaBadge>
      </span>

      <span className="flex w-full items-end justify-between gap-4">
        <span className="min-w-0 text-sm leading-relaxed text-muted-foreground text-pretty">
          {poolEmpty
            ? 'Stok habis? Menangkan isi stok tanpa perlu menunggu.'
            : 'Pilih kotak atau cocokkan kartu buat menang energi dan isi stok.'}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
          Buka
          <GlyphChevron className="size-4 transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      </span>
    </button>
  )
}
