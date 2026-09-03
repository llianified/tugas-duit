'use client'

import type { ArcadeGame } from '@/domain/arcade/arcade'
import { CardMatch } from '@/features/arcade/card-match'
import { LuckyBoxes, PrizeSummary } from '@/features/arcade/lucky-boxes'
import { prizeChancePercent, prizeLabel } from '@/features/arcade/prize'
import { useArcade } from '@/features/arcade/use-arcade'
import type { ArcadeStateResponse } from '@/features/arcade/types'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphBolt, GlyphPlay, GlyphSpinner } from '@/shared/components/glyph'
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
  boxes: 'Pilih satu dari tiga kotak. Isinya diundi server, jadi murni untung-untungan.',
  match: 'Temukan semua pasangan sebelum waktunya habis. Kalah berarti nggak dapat apa-apa.',
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

      <section aria-label="Cara kerja Arena" className="region-under-brand">
        <h2 className="text-base font-semibold tracking-tight">Cara kerjanya</h2>
        <p className="stack-gap-t text-sm leading-relaxed text-muted-foreground text-pretty">
          Hadiahnya energi atau isi stok reward, bukan credit langsung. Stok yang terisi berarti
          ada lagi yang bisa kamu kerjakan hari ini.
        </p>
      </section>

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
      <PageRegion>
        <div className={SURFACE_CARD_CLASS}>
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </PageRegion>
    )
  }

  if (!state.enabled) {
    return (
      <PageRegion>
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
      <PageRegion label={game ? GAME_TITLE[game] : 'Ronde'}>
        <div className={SURFACE_CARD_CLASS}>
          {game === 'match' && phase === 'playing' ? (
            <CardMatch
              seconds={state.matchSeconds}
              busy={busy}
              onFinish={(won) => onSettle({ won })}
            />
          ) : null}

          {game === 'boxes' || result ? (
            <div className="flex flex-col gap-3">
              <LuckyBoxes
                boxCount={state.boxCount}
                revealed={result?.boxes ?? null}
                pick={result?.pick ?? null}
                busy={busy}
                onPick={(pick) => onSettle({ pick })}
              />
              {result ? <PrizeSummary prize={result.prize} /> : null}
            </div>
          ) : null}

          {phase === 'settling' ? (
            <div className="stack-gap-t">
              <TapActionWaiting
                compact
                tone="neutral"
                icon={<GlyphSpinner className="size-4 animate-spin text-muted-foreground" />}
                label="Menghitung"
              />
            </div>
          ) : null}

          {phase === 'result' ? (
            <div className="stack-gap-t">
              <TapAction compact label="Selesai" onClick={onReset} />
            </div>
          ) : null}
        </div>
      </PageRegion>
    )
  }

  return (
    <>
      <PageRegion label="Jatah kamu" badge={`${formatCredits(state.playsLeft)} main`}>
        <ArcadeStatus state={state} />
      </PageRegion>

      <PageRegion label="Pilih permainan">
        <ul className="flex flex-col gap-3">
          {(['boxes', 'match'] as const).map((key) => (
            <li key={key} className={SURFACE_CARD_CLASS}>
              <h3 className="text-[15px] font-bold tracking-tight text-foreground">
                {GAME_TITLE[key]}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground text-pretty">
                {GAME_BLURB[key]}
              </p>
              <div className="stack-gap-t">
                <StartButton
                  state={state}
                  busy={busy}
                  watchingAd={watchingAd}
                  onStart={() => onStart(key)}
                />
              </div>
            </li>
          ))}
        </ul>
      </PageRegion>

      <PageRegion label="Isi hadiahnya">
        <PrizeTable state={state} />
      </PageRegion>
    </>
  )
}

/** Urutan cabang di sini sengaja sama persis dengan `arcadeOpenRefusal` di `domain/arcade/arcade.ts`. Kalau berbeda, tombolnya menawarkan sesuatu yang server tolak dengan alasan lain — dan user yang membaca dua penjelasan berbeda untuk satu ketukan berhenti mempercayai keduanya. Pelajaran yang sama sudah dibayar sekali di `WatchAdToPlay`. */
function StartButton({
  state,
  busy,
  watchingAd,
  onStart,
}: {
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
        icon={<GlyphSpinner className="size-4 animate-spin text-muted-foreground" />}
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
        label="Jeda main"
        meta={formatCountdown(state.cooldownSecondsLeft)}
      />
    )
  }

  /** Stok dan energi sama-sama penuh: tidak ada satu pun hadiah yang muat, jadi rondenya pasti zonk. Ditahan di sini supaya tidak ada iklan yang ditonton untuk hasil yang sudah pasti kosong — penjagaan yang sama berdiri lagi di server sebagai `nothing_to_win`. */
  if (state.winnable.every((entry) => entry.kind === 'blank')) {
    return <TapActionWaiting compact tone="neutral" label="Stok penuh" meta="pakai dulu" />
  }

  const needsAd = state.adGated && !state.hasAdPass

  return (
    <TapAction
      compact
      tone={needsAd ? 'neutral' : 'primary'}
      icon={needsAd ? <GlyphPlay className="size-4 text-muted-foreground" /> : undefined}
      label={needsAd ? 'Tonton iklan' : 'Main'}
      aria-label={
        needsAd
          ? 'Tonton satu iklan untuk membuka satu kali main'
          : 'Mulai satu kali main di Arena'
      }
      onClick={onStart}
    />
  )
}

function ArcadeStatus({ state }: { state: ArcadeStateResponse }) {
  return (
    <dl className={`${SURFACE_CARD_CLASS} grid grid-cols-2 gap-3`}>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Sisa main
        </dt>
        <dd className="mt-1 text-lg font-bold tabular-nums text-foreground">
          {formatCredits(state.playsLeft)}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Jeda
        </dt>
        <dd className="mt-1 text-lg font-bold tabular-nums text-foreground">
          {state.cooldownSecondsLeft > 0 ? formatCountdown(state.cooldownSecondsLeft) : 'Siap'}
        </dd>
      </div>
    </dl>
  )
}

/** Peluangnya ditulis apa adanya, termasuk zonk. Menyembunyikannya membuat ronde kosong terbaca seperti kesalahan aplikasi, dan itu keluhan yang jauh lebih mahal daripada kejujuran satu tabel. */
function PrizeTable({ state }: { state: ArcadeStateResponse }) {
  const total = state.prizes.reduce((sum, entry) => sum + entry.weight, 0)
  const listed = state.prizes.filter((entry) => entry.weight > 0)

  if (listed.length === 0) return null

  return (
    <ul className={`${SURFACE_CARD_CLASS} flex flex-col gap-2.5`}>
      {listed.map((entry) => (
        <li key={entry.kind} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            {entry.kind === 'energy' ? (
              <GlyphBolt className="size-4 shrink-0 text-muted-foreground" />
            ) : null}
            <span className="truncate text-[13px] font-medium text-foreground">
              {prizeLabel({ kind: entry.kind, amount: entry.amount })}
            </span>
          </span>
          <MetaBadge>{prizeChancePercent(entry.weight, total)}%</MetaBadge>
        </li>
      ))}
    </ul>
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
