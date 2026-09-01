'use client'

import { MissionCard } from '@/features/missions/mission-card'
import { PageHeader } from '@/shared/components/page-header'
import { VIEW_TITLE } from '@/navigation/app-view'

/**
 * Misi naik dari tab paling bawah Beranda menjadi view sendiri di nav.
 *
 * Sebagai tab, kartu misi jatuh persis di bawah lipatan pada layar 384px: ia tab
 * pertama dan tetap aktif secara default, tapi barisnya tertutup nav pill, jadi
 * satu-satunya sumber energi gratis di aplikasi ini praktis tidak pernah terlihat.
 * Slot nav-nya diambil dari Riwayat, yang sudah punya gerbang sendiri dari tombol di
 * hero dan dari baris di Profil.
 *
 * View ini sengaja tidak memasang ringkasan besar di `region-under-brand` seperti
 * Riwayat. Angka yang layak diperbesar di halaman ini cuma "berapa misi selesai",
 * dan `MissionCard` sudah menampilkannya sebagai badge tepat di atas daftarnya —
 * mengulangnya sebagai hero hanya membuat satu angka muncul dua kali dalam satu layar.
 */
export function MissionsView({
  refreshKey,
  onClaimed,
}: {
  refreshKey: number
  onClaimed: () => Promise<unknown>
}) {
  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.missions} />

      <section aria-label="Cara kerja misi" className="region-under-brand">
        <h2 className="text-base font-semibold tracking-tight">Cara kerjanya</h2>
        <p className="stack-gap-t text-sm leading-relaxed text-muted-foreground text-pretty">
          Progres misi kebaca sendiri dari task yang kamu kerjakan — nggak ada yang perlu
          diaktifkan dulu. Begitu targetnya kena, energinya tinggal diambil di daftar bawah.
        </p>
      </section>

      <div className="region-t">
        <MissionCard refreshKey={refreshKey} onClaimed={onClaimed} variant="page" />
      </div>

      <div className="flex-1" />
    </div>
  )
}
