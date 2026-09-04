'use client'

import type { ReactNode } from 'react'
import type { ArcadeGame } from '@/domain/arcade/arcade'
import { CardMatch } from '@/features/arcade/card-match'
import { LuckyBoxes, PrizeSummary } from '@/features/arcade/lucky-boxes'
import { prizeChancePercent, prizeLabel } from '@/features/arcade/prize'
import type { ArcadeStateResponse } from '@/features/arcade/types'
import { useArcade } from '@/features/arcade/use-arcade'
import { EmptyState } from '@/shared/components/empty-state'
import {
  GlyphBolt,
  GlyphHelp,
  GlyphPlay,
  GlyphSpinner,
  GlyphTrophy,
} from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { PageHeader } from '@/shared/components/page-header'
import { PageRegion } from '@/shared/components/page-region'
import { SURFACE_CARD_CLASS } from '@/shared/components/surface-card'
import { TapAction, TapActionWaiting } from '@/shared/components/tap-action'
import { formatCountdown, formatCredits } from '@/shared/lib/format'
import { VIEW_TITLE } from '@/navigation/app-view'

const GAME_TITLE: Record<ArcadeGame, string> = {
  boxes: 'Kotak Keberuntungan',
  match: 'Cocokkan Kartu',
}

const GAME_BLURB: Record<ArcadeGame, string> = {
  boxes: 'Pilih satu kotak dan buka hadiahnya.',
  match: 'Temukan tiga pasang sebelum waktu habis.',
}

/** Arena hidup sebagai view sendiri, bukan tab di Beranda, karena satu rondenya menahan layar selama puluhan detik — dan sesuatu yang menahan layar selama itu tidak boleh berbagi ruang dengan kartu task yang sedang berjalan. Slot nav pill sengaja TIDAK ditambah: barisnya dipatok lima dan geometri indikatornya dihitung dari jumlah itu. Pintu masuknya dari kartu di Beranda, persis seperti Riwayat dan Statistik. */
export function ArcadeView({
  watchAd,
  watchingAd,
  refreshSession,
}: {
  watchAd: () => Promise<boolean>
  watchingAd: boolean
  refreshSession: () => Promise<unknown>
}) {
  const { state, phase, game, result, start, settle, reset } = useArcade({ watchAd, refreshSession })

  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.arcade} />

      <ArcadeBody
        state={state}
        phase={phase}
        game={game}
        result={result}
        watchingAd={watchingAd}
        onStart={start}
        onSettle={settle}
        onReset={reset}
      />

      <div className="flex-1" />
    </div>
  )
}

function ArcadeBody({
  state,
  phase,
  game,
  result,
  watchingAd,
  onStart,
  onSettle,
  onReset,
}: {
  state: ArcadeStateResponse | null
  phase: ReturnType<typeof useArcade>['phase']
  game: ArcadeGame | null
  result: ReturnType<typeof useArcade>['result']
  watchingAd: boolean
  onStart: (game: ArcadeGame) => void
  onSettle: (payload: { pick?: number; won?: boolean }) => void
  onReset: () => void
}) {
  if (!state) {
    return (
      <PageRegion className="region-under-brand">
        <div className={`${SURFACE_CARD_CLASS} flex flex-col gap-3`} aria-label="Memuat Arena">
          <div className="h-20 animate-pulse rounded-lg bg-background/50 motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-lg bg-background/50 motion-reduce:animate-none" />
        </div>
      </PageRegion>
    )
  }

  if (!state.enabled) {
    return (
      <PageRegion className="region-under-brand">
        <EmptyState
          icon={<GlyphPlay className="glyph-md text-muted-foreground" />}
          title="Arena lagi ditutup"
          description="Nanti dibuka lagi. Sementara ini lanjut kerjakan task dulu."
        />
      </PageRegion>
    )
  }

  const busy = phase === 'opening' || phase === 'settling' || watchingAd

  if (phase === 'playing' || phase === 'settling' || phase === 'result') {
    return (
      <PageRegion
        label={game ? GAME_TITLE[game] : 'Ronde Arena'}
        badge={phase === 'result' ? 'Selesai' : phase === 'settling' ? 'Menghitung' : 'Berlangsung'}
        className="region-under-brand"
      >
        <div className={`${SURFACE_CARD_CLASS} label-gap-t flex flex-col gap-4`}>
          {game === 'match' && phase === 'playing' ? (
            <CardMatch
              seconds={state.matchSeconds}
              busy={busy}
              onFinish={(won) => onSettle({ won })}
            />
          ) : null}

          {game === 'boxes' ? (
            <>
              {phase === 'playing' ? (
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  Hadiahnya sudah diacak. Pilih satu kotak untuk membukanya.
                </p>
              ) : null}
              <LuckyBoxes
                boxCount={state.boxCount}
                revealed={result?.boxes ?? null}
                pick={result?.pick ?? null}
                busy={busy}
                onPick={(pick) => onSettle({ pick })}
              />
            </>
          ) : null}

          {phase === 'settling' ? (
            <div className="flex flex-col items-center gap-3 py-5 text-center" role="status">
              <span className="flex size-11 items-center justify-center rounded-full bg-background/55 ring-border">
                <GlyphSpinner className="size-5 animate-spin text-primary motion-reduce:animate-none" />
              </span>
              <span>
                <span className="block text-base font-bold tracking-tight text-foreground">
                  Menghitung hasil
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Hadiahmu sedang dikonfirmasi.
                </span>
              </span>
            </div>
          ) : null}

          {phase === 'result' && result ? (
            <>
              <PrizeSummary prize={result.prize} />
              <TapAction compact label="Selesai" onClick={onReset} />
            </>
          ) : null}
        </div>
      </PageRegion>
    )
  }

  return (
    <>
      <ArcadeHero state={state} />

      <PageRegion label="Pilih permainan" badge={`${formatCredits(state.playsLeft)} main tersisa`}>
        <ul className="label-gap-t grid grid-cols-2 gap-3">
          {(['boxes', 'match'] as const).map((key) => (
            <GameCard
              key={key}
              game={key}
              state={state}
              busy={busy}
              watchingAd={watchingAd}
              onStart={() => onStart(key)}
            />
          ))}
        </ul>
      </PageRegion>

      <PageRegion label="Peluang hadiah" badge="Transparan">
        <PrizeTable state={state} />
      </PageRegion>
    </>
  )
}

function ArcadeHero({ state }: { state: ArcadeStateResponse }) {
  return (
    <section aria-label="Ringkasan Arena" className="region-under-brand">
      <div className="rounded-lg bg-primary p-[var(--surface-p)] text-primary-foreground">
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10">
            <GlyphTrophy className="size-5" />
          </span>
          <MetaBadge className="bg-primary-foreground/10 !text-primary-foreground ring-primary-foreground/15">
            2 permainan
          </MetaBadge>
        </div>

        <div className="mt-5">
          <h2 className="font-display text-xl font-bold tracking-tight text-balance">
            Main sebentar, lanjut cari cuan.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-primary-foreground/75 text-pretty">
            Menangkan energi atau isi stok reward. Bukan credit instan, tapi kesempatan buat
            lanjut ngerjain task hari ini.
          </p>
        </div>

        <dl className="mt-5 grid grid-cols-2 divide-x divide-primary-foreground/15 rounded-lg bg-primary-foreground/[0.08] py-3">
          <div className="px-3">
            <dt className="text-xs font-medium text-primary-foreground/65">Sisa main</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">
              {formatCredits(state.playsLeft)}x
            </dd>
          </div>
          <div className="px-3">
            <dt className="text-xs font-medium text-primary-foreground/65">Bisa main</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">
              {state.cooldownSecondsLeft > 0 ? formatCountdown(state.cooldownSecondsLeft) : 'Sekarang'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

function GameCard({
  game,
  state,
  busy,
  watchingAd,
  onStart,
}: {
  game: ArcadeGame
  state: ArcadeStateResponse
  busy: boolean
  watchingAd: boolean
  onStart: () => void
}) {
  return (
    <li className={`${SURFACE_CARD_CLASS} flex min-w-0 flex-col gap-3`}>
      <GameMark game={game} />
      <span className="flex flex-1 flex-col gap-1.5">
        <h3 className="text-sm font-bold leading-snug tracking-tight text-foreground text-balance">
          {GAME_TITLE[game]}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {GAME_BLURB[game]}
        </p>
      </span>
      <StartButton
        game={game}
        state={state}
        busy={busy}
        watchingAd={watchingAd}
        onStart={onStart}
      />
    </li>
  )
}

function GameMark({ game }: { game: ArcadeGame }) {
  if (game === 'boxes') {
    return (
      <span className="flex size-10 items-center justify-center rounded-lg bg-background/55 text-primary ring-border">
        <GlyphHelp className="size-5" />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className="flex h-10 w-fit items-center gap-1 rounded-lg bg-background/55 px-2 text-xs font-black text-primary ring-border"
    >
      <span>◆</span>
      <span>●</span>
      <span>▲</span>
    </span>
  )
}

/** Urutan cabang di sini sengaja sama persis dengan `arcadeOpenRefusal` di `domain/arcade/arcade.ts`. Kalau berbeda, tombolnya menawarkan sesuatu yang server tolak dengan alasan lain — dan user yang membaca dua penjelasan berbeda untuk satu ketukan berhenti mempercayai keduanya. Pelajaran yang sama sudah dibayar sekali di `WatchAdToPlay`. */
function StartButton({
  game,
  state,
  busy,
  watchingAd,
  onStart,
}: {
  game: ArcadeGame
  state: ArcadeStateResponse
  busy: boolean
  watchingAd: boolean
  onStart: () => void
}) {
  if (busy) {
    return (
      <TapActionWaiting
        compact
        tone="neutral"
        icon={<GlyphSpinner className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />}
        label={watchingAd ? 'Memuat iklan' : 'Menyiapkan'}
      />
    )
  }

  if (state.playsLeft <= 0) {
    return <TapActionWaiting compact tone="neutral" label="Jatah habis" meta="besok" />
  }

  if (state.cooldownSecondsLeft > 0) {
    return (
      <TapActionWaiting
        compact
        tone="neutral"
        label="Jeda"
        meta={formatCountdown(state.cooldownSecondsLeft)}
      />
    )
  }

  /** Stok dan energi sama-sama penuh: tidak ada satu pun hadiah yang muat, jadi rondenya pasti zonk. Ditahan di sini supaya tidak ada iklan yang ditonton untuk hasil yang sudah pasti kosong — penjagaan yang sama berdiri lagi di server sebagai `nothing_to_win`. */
  if (state.winnable.every((entry) => entry.kind === 'blank')) {
    return <TapActionWaiting compact tone="neutral" label="Stok penuh" />
  }

  const needsAd = state.adGated && !state.hasAdPass

  return (
    <TapAction
      compact
      tone={needsAd ? 'neutral' : 'primary'}
      icon={needsAd ? <GlyphPlay className="size-4 text-muted-foreground" /> : undefined}
      label={needsAd ? 'Buka' : 'Main'}
      aria-label={
        needsAd
          ? `Tonton satu iklan untuk membuka ${GAME_TITLE[game]}`
          : `Mulai ${GAME_TITLE[game]}`
      }
      onClick={onStart}
    />
  )
}

/** Peluangnya ditulis apa adanya, termasuk zonk. Menyembunyikannya membuat ronde kosong terbaca seperti kesalahan aplikasi, dan itu keluhan yang jauh lebih mahal daripada kejujuran satu tabel. */
function PrizeTable({ state }: { state: ArcadeStateResponse }) {
  const total = state.prizes.reduce((sum, entry) => sum + entry.weight, 0)
  const listed = state.prizes.filter((entry) => entry.weight > 0)

  if (listed.length === 0) return null

  return (
    <ul className={`${SURFACE_CARD_CLASS} label-gap-t flex flex-col gap-3`}>
      {listed.map((entry) => (
        <li key={entry.kind} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <PrizeIcon kind={entry.kind} />
            <span className="truncate text-sm font-medium text-foreground">
              {prizeLabel({ kind: entry.kind, amount: entry.amount })}
            </span>
          </span>
          <MetaBadge>{prizeChancePercent(entry.weight, total)}%</MetaBadge>
        </li>
      ))}
    </ul>
  )
}

function PrizeIcon({ kind }: { kind: ArcadeStateResponse['prizes'][number]['kind'] }) {
  let icon: ReactNode
  if (kind === 'energy') icon = <GlyphBolt className="size-4" />
  else if (kind === 'pool') icon = <GlyphTrophy className="size-4" />
  else icon = <span className="text-xs font-black">—</span>

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/55 text-muted-foreground ring-border">
      {icon}
    </span>
  )
}

/** Layar tutup untuk view yang dicapai lewat tumpukan riwayat setelah saklarnya dimatikan. Bentuknya sengaja sama dengan `LeaderboardComingSoon`: fitur yang dimatikan dari panel adalah keadaan normal di app ini, bukan kesalahan yang perlu diteriakkan. */
export function ArcadeClosed() {
  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.arcade} />

      <EmptyState
        icon={<GlyphPlay className="glyph-md text-muted-foreground" />}
        title="Arena lagi ditutup"
        description="Nanti dibuka lagi. Sementara ini lanjut kerjakan task dulu."
      />
    </div>
  )
}
