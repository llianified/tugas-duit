'use client'

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { WatchAdToPlay } from '@/features/ads/watch-ad-to-play'
import { DifficultyBadge } from '@/features/captcha/components/difficulty-badge'
import { EnergyRecoverySheet } from '@/features/home/energy-recovery-sheet'
import { TapAction, TapActionWaiting } from '@/shared/components/tap-action'
import { hapticTap } from '@/shared/lib/haptic'
import type { Challenge } from '@/domain/task/challenge'
import { creditsToRupiah } from '@/domain/economy/economy'
import { energyCostPerTask, type EnergyFill } from '@/domain/economy/energy'
import {
  formatCountdown,
  formatCredits,
  formatLongCountdown,
  formatRupiah,
} from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Lama sobekan karcis. Angkanya dipasang sebagai `--tear-ms` di elemen kartu, jadi CSS dan penahan perpindahan halaman membaca satu sumber yang sama. */
const TEAR_MS = 520

function reducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function ActiveTask({
  task,
  energy,
  energyMax,
  energyFill,
  rewardPoolCredits,
  rewardPoolSecondsToNext,
  adsEnabled,
  adViewsLeft,
  adCooldownSecondsLeft,
  adPassReady,
  watchingAd,
  onStart,
  onStartWithAd,
  onOpenMissions,
  onOpenPremium,
}: {
  task: Challenge
  energy: number
  energyMax: number
  energyFill: EnergyFill
  rewardPoolCredits: number | null
  rewardPoolSecondsToNext: number | null
  adsEnabled: boolean
  adViewsLeft: number
  adCooldownSecondsLeft: number
  adPassReady: boolean
  watchingAd: boolean
  /** `hold` adalah janji yang menahan perpindahan ke halaman task sampai animasi sobekan selesai. Ia dikirim ke atas, bukan dijalankan di sini, karena yang tahu kapan halaman boleh berganti adalah alur task — dan permintaan `/api/task/start` tetap jalan berbarengan dengan animasinya. Nilai kembaliannya `false` kalau task gagal dimulai, supaya karcisnya bisa dipulihkan dan user tidak melihat kartu yang hilang tanpa sebab. */
  onStart: (hold?: Promise<unknown>) => Promise<boolean>
  onStartWithAd: () => void
  onOpenMissions: () => void
  onOpenPremium: (() => void) | null
}) {
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [tearing, setTearing] = useState(false)
  const poolEmpty = rewardPoolCredits === 0
  const energyEmpty = energy < energyCostPerTask()
  const waiting = poolEmpty || energyEmpty

  /** Sobek dulu, pindah halaman setelah keduanya siap. Animasinya TIDAK menunda permintaan ke server: keduanya mulai di ketukan yang sama dan halaman berganti setelah dua-duanya beres. Kalau animasinya dijalankan lebih dulu lalu request menyusul, setiap ketukan jadi `TEAR_MS` lebih lambat tanpa menambah apa pun. */
  const tearAndStart = useCallback(() => {
    if (tearing) return
    if (reducedMotion()) {
      void onStart()
      return
    }
    setTearing(true)
    const hold = new Promise((resolve) => {
      window.setTimeout(resolve, TEAR_MS)
    })
    void onStart(hold).then((started) => {
      if (!started) setTearing(false)
    })
  }, [onStart, tearing])

  return (
    <section aria-label="Task yang tersedia">
      {/* Karcisnya dua bagian yang berhimpit di perforasi, bukan satu kotak dengan garis di tengahnya. Pemisahan ini yang membuat sobekannya nyata: saat "Mulai" ditekan, pangkal dan sobekannya berjalan ke arah berlawanan dengan tepi bergerigi. Lihat `--tear-*` di `globals.css`. */}
      <div
        className="task-card"
        data-tearing={tearing ? 'true' : undefined}
        style={{ '--tear-ms': `${TEAR_MS}ms` } as CSSProperties}
      >
        <div className="ticket-part ticket-part-top">
          <TaskHeading title={task.title} serial={task.id} difficulty={task.difficulty} />
          {/* Perforasi memisahkan "apa tasknya" dari "berapa harganya" — sama
              seperti karcis: bagian atas keterangan, bawah yang disobek. */}
          <div className="block-gap-t ticket-perf" aria-hidden />
        </div>
        <div className="ticket-part ticket-part-bottom">
          <TaskStats
            maxReward={task.maxReward}
            energy={energy}
            energyMax={energyMax}
            energyEmpty={energyEmpty}
            energyFill={energyFill}
          />
          <div className="cta-gap flex items-stretch gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            <StartAction
              waiting={waiting}
              poolEmpty={poolEmpty}
              energy={energy}
              energyMax={energyMax}
              energyFill={energyFill}
              rewardPoolSecondsToNext={rewardPoolSecondsToNext}
              onStart={tearAndStart}
              onRecover={() => setRecoveryOpen(true)}
            />
            <WatchAdToPlay
              enabled={adsEnabled}
              viewsLeft={adViewsLeft}
              cooldownSecondsLeft={adCooldownSecondsLeft}
              passReady={adPassReady}
              watching={watchingAd}
              poolEmpty={poolEmpty}
              onWatch={onStartWithAd}
            />
          </div>
        </div>
      </div>

      <EnergyRecoverySheet
        open={recoveryOpen}
        onOpenChange={setRecoveryOpen}
        energy={energy}
        energyMax={energyMax}
        fill={energyFill}
        adsEnabled={adsEnabled}
        adViewsLeft={adViewsLeft}
        adReady={adPassReady || adCooldownSecondsLeft === 0}
        onWatchAd={onStartWithAd}
        onOpenMissions={onOpenMissions}
        onOpenPremium={onOpenPremium}
      />
    </section>
  )
}

/** Kepala karcis: baris cetakan di atas, judul di bawahnya. Tingkat kesulitan pindah ke baris kecil bersama nomor seri, bukan lagi berimbang di samping judul. Alasannya bukan estetika semata — judul dan lencana yang sebaris membuat keduanya sama-sama menuntut dibaca lebih dulu, padahal yang perlu dikenali sekejap cuma tasknya apa. Nomor serinya diambil dari `task.id` yang datang dari server, jadi ia sama di HTML server dan klien; tidak ada nilai acak yang dibuat saat render. */
function TaskHeading({
  title,
  serial,
  difficulty,
}: {
  title: Challenge['title']
  serial: Challenge['id']
  difficulty: Challenge['difficulty']
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="home-tag truncate">
          Tiket <span className="tabular-nums">{serialCode(serial)}</span>
        </p>
        <DifficultyBadge difficulty={difficulty} />
      </div>
      <h2 className="stack-gap-t min-w-0 text-[22px] font-bold leading-tight tracking-[-0.02em] text-balance text-foreground">
        {title}
      </h2>
    </div>
  )
}

function serialCode(id: string) {
  return `#${id.replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase()}`
}

function TaskStats({
  maxReward,
  energy,
  energyMax,
  energyEmpty,
  energyFill,
}: {
  maxReward: number
  energy: number
  energyMax: number
  energyEmpty: boolean
  energyFill: EnergyFill
}) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-x-3">
      <Stat
        label="Maks"
        value={`+${formatCredits(maxReward)}`}
        note={formatRupiah(creditsToRupiah(maxReward))}
        hint="Reward tertinggi untuk task ini. Nilainya turun kalau pengerjaannya lebih lama, dan dibatasi sisa stok reward kamu."
      />
      <Stat
        label="Biaya"
        value={formatCredits(energyCostPerTask())}
        note="energi"
        hint={`Setiap task memotong ${formatCredits(energyCostPerTask())} energi.`}
      />
      <Stat
        label="Energi"
        value={
          <span className={cn(energyEmpty && 'text-primary')}>
            {formatCredits(energy)}
            <span className="text-muted-foreground/60">/{formatCredits(energyMax)}</span>
          </span>
        }
        note={
          energyFill.secondsToFull === null
            ? 'penuh'
            : `penuh ${formatLongCountdown(energyFill.secondsToFull)}`
        }
        hint={`Energi tersisa ${formatCredits(energy)} dari ${formatCredits(energyMax)}. Terisi sendiri tanpa perlu membuka aplikasi.`}
      />
    </dl>
  )
}

function Stat({
  label,
  value,
  note,
  hint,
}: {
  label: string
  value: ReactNode
  note: string
  hint: string
}) {
  return (
    <div className="stat-tile" title={hint}>
      <dt className="home-tag">{label}</dt>
      <dd className="mt-1 text-lg font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </dd>
      <dd className="text-[11px] font-normal tabular-nums text-muted-foreground/70">{note}</dd>
    </div>
  )
}

/** Energi habis membuka jalan keluar, stok habis tetap menunggu. Bedanya bukan kosmetik: energi punya jalan keluar yang dimiliki user sendiri (tiket iklan, misi, premium), sedangkan stok reward diisi oleh sistem dan tidak ada tombol yang bisa mempercepatnya. Jadi hanya energi yang jadi tombol — menawarkan aksi untuk hal yang tidak bisa dia ubah cuma memindahkan kekecewaan satu ketukan lebih jauh. */
function StartAction({
  waiting,
  poolEmpty,
  energy,
  energyMax,
  energyFill,
  rewardPoolSecondsToNext,
  onStart,
  onRecover,
}: {
  waiting: boolean
  poolEmpty: boolean
  energy: number
  energyMax: number
  energyFill: EnergyFill
  rewardPoolSecondsToNext: number | null
  onStart: () => void
  onRecover: () => void
}) {
  if (!waiting) {
    return (
      <TapAction
        compact
        label="Mulai"
        aria-label={`Mulai task dengan memakai ${formatCredits(energyCostPerTask())} energi, sisa ${formatCredits(energy)} dari ${formatCredits(energyMax)}`}
        onClick={() => {
          hapticTap()
          onStart()
        }}
      />
    )
  }

  if (poolEmpty) {
    return (
      <TapActionWaiting
        compact
        label="Stok habis"
        meta={
          rewardPoolSecondsToNext === null ? undefined : formatCountdown(rewardPoolSecondsToNext)
        }
      />
    )
  }

  const secondsToFull = energyFill.secondsToFull

  return (
    <TapAction
      compact
      tone="neutral"
      label="Isi energi"
      meta={secondsToFull === null ? undefined : formatLongCountdown(secondsToFull)}
      aria-label={
        secondsToFull === null
          ? 'Energi habis, lihat cara lanjut tanpa menunggu'
          : `Energi habis, penuh dalam ${formatLongCountdown(secondsToFull)}. Lihat cara lanjut tanpa menunggu`
      }
      onClick={() => {
        hapticTap()
        onRecover()
      }}
    />
  )
}
