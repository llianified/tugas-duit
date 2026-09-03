'use client'

import { GlyphChevron, GlyphPlay } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
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
      aria-label="Buka Arena, menangkan energi atau isi stok reward"
      className={cn(
        SURFACE_CARD_CLASS,
        'focus-ring transition-ui press-scale-soft flex w-full items-center gap-3 text-left',
        poolEmpty && 'ring-1 ring-primary/40',
      )}
    >
      <IconCircle tone={poolEmpty ? 'primary' : 'muted'}>
        <GlyphPlay className="size-4" />
      </IconCircle>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold tracking-tight text-foreground">Arena</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground text-pretty">
          {poolEmpty
            ? 'Stok habis? Menangkan isi stok di sini, nggak perlu nunggu.'
            : 'Menangkan energi atau isi stok reward.'}
        </span>
      </span>

      <GlyphChevron className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
