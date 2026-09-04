'use client'

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { WatchAdToPlay } from '@/features/ads/watch-ad-to-play'
import { DifficultyBadge } from '@/features/captcha/components/difficulty-badge'
import { EnergyRecoverySheet } from '@/features/home/energy-recovery-sheet'
import { MetaBadge } from '@/shared/components/meta-badge'
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
  turboRewardEnabled,
  energy,
  energyMax,
  energyFill,
  rewardPoolCredits,
  rewardPoolSecondsToNext,
  adsEnabled,
  adViewsLeft,
  adCooldownSecondsLeft,
  adPassReady,
  adPassSecondsLeft,
  adEntryOpen,
  watchingAd,
  onStart,
  onStartWithAd,
  onOpenMissions,
  onOpenPremium,
}: {
  task: Challenge
  turboRewardEnabled: boolean
  energy: number
  energyMax: number
  energyFill: EnergyFill
  rewardPoolCredits: number | null
  rewardPoolSecondsToNext: number | null
  adsEnabled: boolean
  adViewsLeft: number
  adCooldownSecondsLeft: number
  adPassReady: boolean
  adPassSecondsLeft: number | null
  adEntryOpen: boolean
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
  /** Task yang sudah pernah dimulai tidak menagih apa pun lagi: `startChallenge` melakukan seluruh pemungutan ongkos di dalam cabang `fresh`, jadi melanjutkannya lolos tanpa energi maupun stok reward. Tanpa pembedaan ini, user yang menekan back lalu energinya habis terkunci dari task yang ongkosnya SUDAH dia bayar. */
  const resuming = task.startedAt !== null
  const waiting = !resuming && (poolEmpty || energyEmpty)

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
        className="task-card active-task-card"
        data-tearing={tearing ? 'true' : undefined}
        style={{ '--tear-ms': `${TEAR_MS}ms` } as CSSProperties}
      >
        <div className="ticket-part ticket-part-top">
          <TaskHeading
            title={task.title}
            serial={task.id}
            difficulty={task.difficulty}
            turboRewardEnabled={turboRewardEnabled}
          />
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
              resuming={resuming}
              watchingAd={watchingAd}
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
              passSecondsLeft={adPassSecondsLeft}
              entryOpen={adEntryOpen}
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
        adPassReady={adPassReady}
        adCooldownSecondsLeft={adCooldownSecondsLeft}
        adEntryOpen={adEntryOpen}
        watchingAd={watchingAd}
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
  turboRewardEnabled,
}: {
  title: Challenge['title']
  serial: Challenge['id']
  difficulty: Challenge['difficulty']
  turboRewardEnabled: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="home-tag flex min-w-0 items-center gap-1.5 truncate">
          <span>Tiket <span className="tabular-nums">{serialCode(serial)}</span></span>
          {turboRewardEnabled ? <MetaBadge tone="primary">Turbo</MetaBadge> : null}
        </p>
        <DifficultyBadge difficulty={difficulty} />
      </div>
      <h2 className="stack-gap-t min-w-0 text-xl font-bold leading-tight tracking-[-0.02em] text-balance text-foreground">
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
    <dl className="grid grid-cols-3 gap-x-3">
      <Stat
        label="Maks"
        value={`+${formatCredits(maxReward)}`}
        note={formatRupiah(creditsToRupiah(maxReward))}
      />
      <Stat label="Biaya" value={formatCredits(energyCostPerTask())} note="energi" />
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
      />
    </dl>
  )
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="stat-tile">
      <dt className="home-tag">{label}</dt>
      <dd className="mt-1 text-lg font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </dd>
      <dd className="truncate text-[11px] font-normal tabular-nums text-muted-foreground">{note}</dd>
    </div>
  )
}

/** Energi habis membuka jalan keluar, stok habis tetap menunggu. Bedanya bukan kosmetik: energi punya jalan keluar yang dimiliki user sendiri (tiket iklan, misi, premium), sedangkan stok reward diisi oleh sistem dan tidak ada tombol yang bisa mempercepatnya. Jadi hanya energi yang jadi tombol — menawarkan aksi untuk hal yang tidak bisa dia ubah cuma memindahkan kekecewaan satu ketukan lebih jauh. */
function StartAction({
  waiting,
  poolEmpty,
  resuming,
  watchingAd,
  energy,
  energyMax,
  energyFill,
  rewardPoolSecondsToNext,
  onStart,
  onRecover,
}: {
  waiting: boolean
  poolEmpty: boolean
  resuming: boolean
  watchingAd: boolean
  energy: number
  energyMax: number
  energyFill: EnergyFill
  rewardPoolSecondsToNext: number | null
  onStart: () => void
  onRecover: () => void
}) {
  /** Selagi iklan berhadiah tayang, tidak ada satu pun ongkos masuk yang boleh dibayar. Tanpa kunci ini user bisa menekan "Mulai", membayar energi, dan pindah ke captcha sementara tiket yang baru saja dia tonton menyusul masuk lalu hangus tanpa terpakai — dua ongkos untuk satu task. */
  if (watchingAd) {
    return <TapActionWaiting compact label="Tunggu iklan" />
  }

  if (!waiting) {
    return (
      <TapAction
        compact
        label={resuming ? 'Lanjutkan' : 'Mulai'}
        aria-label={
          resuming
            ? 'Lanjutkan task yang sudah dimulai, tanpa ongkos tambahan'
            : `Mulai task dengan memakai ${formatCredits(energyCostPerTask())} energi, sisa ${formatCredits(energy)} dari ${formatCredits(energyMax)}`
        }
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
