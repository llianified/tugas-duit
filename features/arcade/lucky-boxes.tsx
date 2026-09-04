'use client'

import type { ArcadePrize } from '@/domain/arcade/arcade'
import { prizeDetail, prizeLabel } from '@/features/arcade/prize'
import { GlyphBolt, GlyphCross, GlyphTrophy } from '@/shared/components/glyph'
import { hapticTap } from '@/shared/lib/haptic'
import { cn } from '@/shared/lib/utils'

/** Kotak Keberuntungan: tiga kotak, satu ketukan. Tidak ada unsur keterampilan sama sekali, dan itu disengaja — hasilnya digulirkan server sebelum layar ini tahu apa pun, jadi tidak ada yang bisa dimenangkan dengan menipu klien. | Ketiga kotak dibuka setelah pilihan dijatuhkan, termasuk dua yang tidak dipilih. Server memang mengundi tiga hadiah terpisah, jadi memperlihatkan isi kotak lain bukan karangan layar ini: itu benar-benar yang akan didapat kalau kotak itu yang diketuk. */
export function LuckyBoxes({
  boxCount,
  revealed,
  pick,
  busy,
  onPick,
}: {
  boxCount: number
  /** Isi ketiga kotak, baru ada setelah rondenya disetel. */
  revealed: ArcadePrize[] | null
  pick: number | null
  busy: boolean
  onPick: (index: number) => void
}) {
  return (
    <ul className="grid grid-cols-3 gap-2.5" aria-label="Tiga kotak hadiah">
      {Array.from({ length: boxCount }, (_, index) => {
        const prize = revealed?.[index] ?? null
        const chosen = pick === index

        return (
          <li key={index}>
            <button
              type="button"
              disabled={busy || revealed !== null}
              aria-label={
                prize
                  ? `Kotak ${index + 1}: ${prizeLabel(prize)}${chosen ? ', pilihanmu' : ''}`
                  : `Buka kotak ${index + 1} dari ${boxCount}`
              }
              onClick={() => {
                hapticTap()
                onPick(index)
              }}
              className={cn(
                'focus-ring transition-ui press-scale-soft flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-lg p-2 text-center disabled:pointer-events-none motion-reduce:transition-none',
                prize
                  ? chosen
                    ? 'bg-primary/15 text-primary ring-1 ring-primary'
                    : 'bg-background/45 text-muted-foreground ring-border opacity-55'
                  : 'bg-background/55 text-muted-foreground ring-border hover:bg-background/75 active:bg-background',
              )}
            >
              {prize ? (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg text-base font-black',
                      chosen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {prize.kind === 'blank' ? (
                      '—'
                    ) : prize.kind === 'energy' ? (
                      <GlyphBolt className="size-4" />
                    ) : (
                      <GlyphTrophy className="size-4" />
                    )}
                  </span>
                  <span className="text-xs font-bold leading-snug tracking-tight text-current text-balance">
                    {prizeLabel(prize)}
                  </span>
                  {chosen ? <span className="text-xs font-medium opacity-70">Pilihanmu</span> : null}
                </>
              ) : (
                <ClosedBox number={index + 1} />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ClosedBox({ number }: { number: number }) {
  return (
    <>
      <span aria-hidden className="relative flex h-11 w-12 items-end justify-center">
        <span className="absolute top-1 h-2 w-11 rounded-sm bg-primary/35 ring-1 ring-primary/55" />
        <span className="flex h-8 w-10 items-center justify-center rounded-sm bg-primary/15 text-base font-black text-primary ring-1 ring-primary/45">
          {number}
        </span>
      </span>
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pilih</span>
    </>
  )
}

/** Ringkasan hasil ronde. Bentuknya sengaja mandiri agar ronde kartu dan ronde kotak memakai satu bahasa hasil tanpa merender papan permainan yang salah. */
export function PrizeSummary({ prize }: { prize: ArcadePrize }) {
  const won = prize.kind !== 'blank'

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-view-in flex flex-col items-center gap-3 rounded-lg bg-background/55 p-4 text-center ring-border motion-reduce:animate-none"
    >
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-full',
          won ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground ring-border',
        )}
      >
        {won ? <GlyphTrophy className="size-5" /> : <GlyphCross className="size-5" />}
      </span>
      <span>
        <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {won ? 'Hadiah kamu' : 'Belum beruntung'}
        </span>
        <span className="mt-1 block text-lg font-bold tracking-tight text-foreground text-balance">
          {prizeLabel(prize)}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground text-pretty">
          {prizeDetail(prize)}
        </span>
      </span>
    </div>
  )
}
