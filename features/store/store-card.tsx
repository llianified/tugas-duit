'use client'

import { storeCatalog } from '@/domain/store/store'
import { GlyphChevron, GlyphWallet } from '@/shared/components/glyph'
import { formatCredits } from '@/shared/lib/format'
import { hapticTap } from '@/shared/lib/haptic'

/** Pintu masuk Toko TD, bertetangga dengan kartu Arena di daftar misi.
 *
 * Kalimatnya menyebut apa yang DIDAPAT, bukan apa yang dibayar. Rak ini satu-satunya tempat saldo
 * berkurang tanpa jadi Rupiah, dan kartu yang membuka dengan "belanjakan TD" membaca seperti
 * tagihan — padahal yang ditawarkan justru jalan keluar buat saldo yang belum bisa dicairkan. */
export function StoreCard({ poolEmpty, onOpen }: { poolEmpty: boolean; onOpen: () => void }) {
  /** Dihitung dari katalog, bukan ditulis tangan. Angkanya dulu `2` mati di markup, dan ia langsung
   * berbohong begitu rak melebar — persis jenis kesalahan yang tidak menggagalkan apa pun dan tetap
   * terbaca setiap hari. `storeCatalog()` membaca konfigurasi yang sudah dipasang potret sesi, jadi
   * rak kosmetik yang ditutup admin ikut terhitung dengan benar tanpa satu permintaan tambahan. */
  const count = storeCatalog().length

  return (
    <button
      type="button"
      onClick={() => {
        hapticTap()
        onOpen()
      }}
      aria-label="Buka Toko TD, tukar saldo atau bayar pakai QRIS"
      className="focus-ring transition-ui press-scale-soft group flex w-full text-left"
    >
      <span className="stamp stamp-card stamp-primary min-w-0 flex-1">
        <span className="stamp-card-head flex items-start justify-between gap-3">
          <span className="home-tag stamp-tag pt-1">Toko</span>
          <span className="flex flex-col items-end gap-1">
            <span className="num-display stamp-ink-fg text-[1.375rem]">
              {formatCredits(count)}
            </span>
            <span className="home-tag">barang</span>
          </span>
        </span>

        <span className="stamp-card-lead stack-gap-t flex items-center gap-2">
          <span className="stamp-portrait">
            <GlyphWallet className="stamp-ink-fg size-4" />
          </span>
          <span className="text-sm font-semibold leading-snug text-foreground">
            Saldomu bisa dipakai, bukan cuma ditunggu.
          </span>
        </span>

        <span className="stamp-card-detail stack-gap-t block text-xs leading-snug text-muted-foreground text-pretty">
          {poolEmpty
            ? 'Stok lagi habis — premium sama bingkai tetap bisa ditebus.'
            : 'Tukar TD jadi energi, pass, premium, atau bingkai. Bisa bayar QRIS juga.'}
        </span>

        <span className="stamp-card-foot stamp-foot flex items-center justify-between gap-2">
          <span className="text-[11px] leading-snug text-muted-foreground">Lihat isi raknya</span>
          <span className="stamp-ink-fg flex items-center gap-1 text-xs font-bold">
            Buka Toko
            <GlyphChevron className="size-4 shrink-0 transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </span>
      </span>
    </button>
  )
}
