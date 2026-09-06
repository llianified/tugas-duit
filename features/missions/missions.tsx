'use client'

import { useState } from 'react'
import { arcadeEnabled } from '@/domain/arcade/arcade'
import type { EconomyConfig } from '@/domain/economy/economy-config'
import { storeEnabled } from '@/domain/store/store'
import { ArcadeCard } from '@/features/arcade/arcade-card'
import { TurboRewardCard } from '@/features/home/turbo-reward-card'
import { MissionCard } from '@/features/missions/mission-card'
import { StoreCard } from '@/features/store/store-card'
import { StoreSheet } from '@/features/store/store-sheet'
import { PageHeader } from '@/shared/components/page-header'
import { VIEW_TITLE } from '@/navigation/app-view'

/** Misi naik dari tab paling bawah Beranda menjadi view sendiri di nav. Sebagai tab, kartu misi jatuh persis di bawah lipatan pada layar 384px: ia tab pertama dan tetap aktif secara default, tapi barisnya tertutup nav pill, jadi satu-satunya sumber energi gratis di aplikasi ini praktis tidak pernah terlihat. Slot nav-nya diambil dari Riwayat, yang sudah punya gerbang sendiri dari tombol di hero dan dari baris di Profil. View ini sengaja tidak memasang ringkasan besar di `region-under-brand` seperti Riwayat. Angka yang layak diperbesar di halaman ini cuma "berapa misi selesai", dan `MissionCard` sudah menampilkannya sebagai badge tepat di atas daftarnya — mengulangnya sebagai hero hanya membuat satu angka muncul dua kali dalam satu layar. */
export function MissionsView({
  refreshKey,
  economy,
  rewardPoolCredits,
  rewardPoolMax,
  rewardPoolRegenCredits,
  rewardPoolSecondsToNext,
  onClaimed,
  onOpenArcade,
  referralShareUrl,
}: {
  refreshKey: number
  economy: EconomyConfig
  rewardPoolCredits: number | null
  rewardPoolMax: number | null
  rewardPoolRegenCredits: number | null
  rewardPoolSecondsToNext: number | null
  onClaimed: () => Promise<unknown>
  onOpenArcade: () => void
  referralShareUrl: string
}) {
  const [storeOpen, setStoreOpen] = useState(false)
  const turboReachable = economy.turboRewardEnabled === 1
  const arenaReachable = arcadeEnabled()
  /** Lembarnya sendiri yang membaca isi rak; ini cuma memutuskan kartunya dirender atau tidak,
   * supaya pintu masuk ikut hilang saat toko ditutup dari panel. */
  const storeReachable = storeEnabled()

  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.missions} />

      <section aria-label="Cara kerja misi" className="region-under-brand">
        <h2 className="text-base font-semibold tracking-tight">Cara kerjanya</h2>
        <p className="stack-gap-t text-sm leading-relaxed text-muted-foreground text-pretty">
          Progres soal tercatat otomatis. Misi sosial dibuka lewat tombolnya, terus dikonfirmasi kalau udah kelar.
        </p>
      </section>

      <div className="region-t">
        <MissionCard
          refreshKey={refreshKey}
          onClaimed={onClaimed}
          referralShareUrl={referralShareUrl}
          variant="page"
        />
      </div>

      {turboReachable || arenaReachable || storeReachable ? (
        /* Toko di atas, Turbo Reward di bawah — kebalikan dari urutan sebelumnya. Turbo Reward
           adalah flag komunikasi (lihat migrasi 0037): ia mengumumkan sesuatu yang sudah berlaku,
           jadi membacanya tidak menuntut satu ketukan pun. Toko sebaliknya — satu-satunya kartu di
           deret ini yang membuka rak berisi barang yang bisa dibeli, dan sejak migrasi 0058 ia juga
           satu-satunya pintu pemasukan tunai di luar premium. Yang menuntut aksi berdiri lebih dulu
           daripada yang cuma perlu dibaca. */
        <section aria-label="Pilihan hadiah lainnya" className="region-t flex flex-col gap-3">
          {storeReachable ? (
            <StoreCard poolEmpty={rewardPoolCredits === 0} onOpen={() => setStoreOpen(true)} />
          ) : null}

          {arenaReachable ? (
            <ArcadeCard poolEmpty={rewardPoolCredits === 0} onOpen={onOpenArcade} />
          ) : null}

          {turboReachable ? (
            <TurboRewardCard
              config={economy}
              rewardPoolCredits={rewardPoolCredits}
              rewardPoolMax={rewardPoolMax}
              rewardPoolRegenCredits={rewardPoolRegenCredits}
              rewardPoolSecondsToNext={rewardPoolSecondsToNext}
            />
          ) : null}
        </section>
      ) : null}

      <div className="flex-1" />

      {storeReachable ? (
        <StoreSheet open={storeOpen} onOpenChange={setStoreOpen} onBought={onClaimed} />
      ) : null}
    </div>
  )
}
