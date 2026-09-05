'use client'

import { Dialog } from '@base-ui/react/dialog'
import { creditsToRupiah } from '@/domain/economy/economy'
import type { EconomyConfig } from '@/domain/economy/economy-config'
import { baseRewardPoolCredits } from '@/domain/economy/reward-pool'
import { GlyphBolt, GlyphChevron, GlyphCross } from '@/shared/components/glyph'
import { formatCountdown, formatCredits, formatRupiah } from '@/shared/lib/format'

interface TurboRewardCardProps {
  config: EconomyConfig
  rewardPoolCredits: number | null
  rewardPoolMax: number | null
  rewardPoolRegenCredits: number | null
  rewardPoolSecondsToNext: number | null
}

const REWARD_ROWS = [
  { label: 'Easy', keys: ['rewardEasy1', 'rewardEasy2', 'rewardEasy3'] },
  { label: 'Medium', keys: ['rewardMedium1', 'rewardMedium2', 'rewardMedium3'] },
  { label: 'Hard', keys: ['rewardHard1', 'rewardHard2', 'rewardHard3'] },
] as const

export function TurboRewardCard({
  config,
  rewardPoolCredits,
  rewardPoolMax,
  rewardPoolRegenCredits,
  rewardPoolSecondsToNext,
}: TurboRewardCardProps) {
  const rewardValues = REWARD_ROWS.flatMap((row) => row.keys.map((key) => config[key]))
  const maxRewardCredits = Math.max(...rewardValues)
  const maxRewardIdr = creditsToRupiah(maxRewardCredits)
  const regenCredits = rewardPoolRegenCredits ?? config.rewardPoolRegenCredits
  const regenIdr = creditsToRupiah(regenCredits)
  const poolCurrent = rewardPoolCredits ?? 0
  const poolMax = rewardPoolMax ?? baseRewardPoolCredits()
  const poolFull = rewardPoolCredits !== null && poolCurrent >= poolMax

  return (
    <Dialog.Root>
      <Dialog.Trigger className="focus-ring transition-ui press-scale-soft group flex w-full text-left">
        <span className="stamp stamp-card stamp-primary min-w-0 flex-1">
          <span className="stamp-card-head flex items-start justify-between gap-3">
            <span className="home-tag stamp-tag pt-1">Turbo Reward</span>
            <span className="flex flex-col items-end gap-1">
              <span className="num-display stamp-ink-fg text-[1.375rem]">
                {formatRupiah(maxRewardIdr)}
              </span>
              <span className="home-tag">per soal</span>
            </span>
          </span>

          <span className="stamp-card-lead stack-gap-t flex items-center gap-2">
            <span className="stamp-portrait">
              <GlyphBolt className="stamp-ink-fg size-4" />
            </span>
            <span className="text-sm font-semibold leading-snug text-foreground">
              Reward lebih besar, stok kembali lebih cepat.
            </span>
          </span>

          <span className="stamp-card-detail stack-gap-t block text-xs leading-snug text-muted-foreground">
            Stok sekarang{' '}
            <strong className="font-semibold text-foreground">
              {rewardPoolCredits === null
                ? 'memuat…'
                : `${formatCredits(poolCurrent)}/${formatCredits(poolMax)} TD`}
            </strong>
            . Isi ulang +{formatRupiah(regenIdr)}{' '}
            {poolFull
              ? 'saat stok dipakai.'
              : rewardPoolSecondsToNext === null
                ? 'sedang disiapkan.'
                : `dalam ${formatCountdown(rewardPoolSecondsToNext)}.`}
          </span>

          <span className="stamp-card-foot stamp-foot flex items-center justify-between gap-2">
            <span className="text-[11px] leading-snug text-muted-foreground">
              Lihat rincian reward
            </span>
            <GlyphChevron className="stamp-ink-fg size-4 shrink-0 transition-transform duration-150 group-active:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in fixed inset-0 z-40 bg-scrim duration-150 data-[ending-style]:animate-out data-[ending-style]:fade-out" />
        <Dialog.Popup className="sheet-popup">
          <div className="sheet-grip" aria-hidden="true" />

          <div className="flex shrink-0 items-center gap-2 px-content pt-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GlyphBolt className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold tracking-tight text-foreground">
                Event Turbo Reward
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 truncate text-[11px] leading-none text-muted-foreground">
                Reward besar, stok kembali lebih cepat
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Tutup rincian Turbo Reward"
              className="focus-ring transition-ui relative -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
            >
              <GlyphCross className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-content pb-5">
            <section aria-labelledby="turbo-reward-table-title">
              <div className="rounded-xl bg-primary p-3 text-primary-foreground">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                  Reward tertinggi
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                  {formatRupiah(maxRewardIdr)}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed opacity-85">
                  per soal, tergantung tingkat kesulitan dan jumlah bintang.
                </p>
              </div>

              <h3 id="turbo-reward-table-title" className="mt-4 text-xs font-semibold text-foreground">
                Reward tiap soal
              </h3>
              <div className="mt-2 overflow-hidden rounded-xl border border-border">
                <table className="w-full table-fixed text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-2.5 py-2 text-left font-medium">Level</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">1 bintang</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">2 bintang</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-medium">3 bintang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REWARD_ROWS.map((row) => (
                      <tr key={row.label} className="border-t border-border">
                        <th scope="row" className="px-2.5 py-2.5 text-left font-semibold text-foreground">
                          {row.label}
                        </th>
                        {row.keys.map((key) => (
                          <td key={key} className="px-2 py-2.5 text-right font-medium tabular-nums text-foreground">
                            {formatRupiah(creditsToRupiah(config[key]))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="turbo-pool-title" className="mt-4 rounded-xl bg-muted p-3">
              <h3 id="turbo-pool-title" className="text-xs font-semibold text-foreground">
                Stok reward terus terisi
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Stok bertambah <strong className="font-semibold text-foreground">{formatRupiah(regenIdr)}</strong>{' '}
                setiap <strong className="font-semibold text-foreground">{formatCredits(config.rewardPoolRegenMinutes)} menit</strong>,
                sampai kapasitasmu penuh. Kembali lagi saat stok baru tersedia.
              </p>
            </section>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Reward yang kamu dapat ngikutin sisa stok, tingkat kesulitan, dan kecepatan kamu jawab.
            </p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
