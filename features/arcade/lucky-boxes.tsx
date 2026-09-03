'use client'

import type { ArcadePrize } from '@/domain/arcade/arcade'
import { prizeDetail, prizeLabel } from '@/features/arcade/prize'
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
                  ? `Kotak ${index + 1}: ${prizeLabel(prize)}`
                  : `Buka kotak ${index + 1} dari ${boxCount}`
              }
              onClick={() => {
                hapticTap()
                onPick(index)
              }}
              className={cn(
                'focus-ring transition-ui press-scale-soft flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg p-2 text-center disabled:pointer-events-none',
                prize
                  ? chosen
                    ? 'bg-primary/15 ring-1 ring-primary'
                    : 'bg-muted/40 opacity-55'
                  : 'bg-muted/60 hover:bg-muted active:bg-muted',
              )}
            >
              {prize ? (
                <>
                  <span className="text-[13px] font-bold leading-tight tracking-tight text-foreground text-balance">
                    {prizeLabel(prize)}
                  </span>
                  {chosen ? (
                    <span className="text-[10px] font-medium text-muted-foreground">Pilihanmu</span>
                  ) : null}
                </>
              ) : (
                <span aria-hidden className="text-2xl font-black tabular-nums text-muted-foreground">
                  ?
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Ringkasan satu baris di bawah kotak, dipakai layar hasil. Dipisah dari `LuckyBoxes` supaya kotaknya tetap murni menggambar dan tidak ikut memutuskan kalimat apa yang muncul sesudahnya. */
export function PrizeSummary({ prize }: { prize: ArcadePrize }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold tracking-tight text-foreground">{prizeLabel(prize)}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{prizeDetail(prize)}</p>
    </div>
  )
}
