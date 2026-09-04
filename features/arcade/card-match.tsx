'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MATCH_PAIRS } from '@/domain/arcade/arcade'
import { GlyphCheck } from '@/shared/components/glyph'
import { ProgressBar } from '@/shared/components/progress-bar'
import { formatCountdown } from '@/shared/lib/format'
import { hapticTap } from '@/shared/lib/haptic'
import { cn } from '@/shared/lib/utils'

/** Enam kartu, tiga pasang. Lambangnya teks, bukan glyph: yang dibandingkan mata di sini adalah bentuk padat yang sangat berbeda satu sama lain, sehingga rondenya benar-benar soal mengingat posisi. */
const SYMBOLS = ['◆', '●', '▲'] as const

const FLIP_BACK_MS = 700

type Card = { id: number; symbol: string }

function deal(): Card[] {
  const cards = SYMBOLS.slice(0, MATCH_PAIRS).flatMap((symbol, pair) => [
    { id: pair * 2, symbol },
    { id: pair * 2 + 1, symbol },
  ])
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

/** Cocokkan Kartu: papan dan hasilnya hidup sepenuhnya di klien, lalu menang/kalahnya dilaporkan ke server apa adanya. Itu keputusan yang dicatat panjang di `settleArcadePlay` — yang menahan penyalahgunaan adalah jatah harian, jeda, dan pass iklan yang sudah terbakar saat ronde dibuka, bukan bukti bahwa papannya betul dimainkan. Memverifikasi susunan kartu berarti menyimpan seluruh urutan langkah di server demi menutup celah yang plafonnya sudah tutup. */
export function CardMatch({
  seconds,
  busy,
  onFinish,
}: {
  seconds: number
  busy: boolean
  onFinish: (won: boolean) => void
}) {
  const [cards] = useState<Card[]>(deal)
  const [matched, setMatched] = useState<string[]>([])
  const [flipped, setFlipped] = useState<number[]>([])
  const [deadline] = useState(() => Date.now() + seconds * 1_000)
  const [now, setNow] = useState(() => Date.now())
  /** Menjaga `onFinish` tepat sekali. Menang dan waktu habis bisa jatuh di tick yang sama, dan dua laporan untuk satu ronde membuat yang kedua ditolak `unknown_play` — user membaca "ronde nggak ketemu" untuk ronde yang baru saja dia menangkan. */
  const settled = useRef(false)

  const finish = useCallback(
    (won: boolean) => {
      if (settled.current) return
      settled.current = true
      onFinish(won)
    },
    [onFinish],
  )

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1_000))

  useEffect(() => {
    if (secondsLeft <= 0) finish(false)
  }, [finish, secondsLeft])

  useEffect(() => {
    if (matched.length === MATCH_PAIRS) finish(true)
  }, [finish, matched.length])

  /** Dua kartu terbuka diselesaikan di sini, bukan di dalam `onClick`. Pasangan yang meleset harus tetap terlihat sesaat sebelum ditutup — tanpa jeda itu kartunya tertutup di frame yang sama dengan terbukanya, dan tidak ada yang bisa diingat. */
  useEffect(() => {
    if (flipped.length !== 2) return
    const [first, second] = flipped
    if (cards[first].symbol === cards[second].symbol) {
      setMatched((current) => [...current, cards[first].symbol])
      setFlipped([])
      return
    }
    const timer = setTimeout(() => setFlipped([]), FLIP_BACK_MS)
    return () => clearTimeout(timer)
  }, [cards, flipped])

  const isOpen = useCallback(
    (index: number) => flipped.includes(index) || matched.includes(cards[index].symbol),
    [cards, flipped, matched],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-bold tracking-tight text-foreground">
            Temukan {MATCH_PAIRS} pasang
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {matched.length} dari {MATCH_PAIRS} pasangan cocok
          </span>
        </span>
        <span
          aria-label={`Sisa waktu ${formatCountdown(secondsLeft)}`}
          className={cn(
            'rounded-lg bg-background/55 px-2.5 py-1.5 text-sm font-bold tabular-nums ring-border',
            secondsLeft <= 5 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatCountdown(secondsLeft)}
        </span>
      </div>

      <ProgressBar
        value={secondsLeft}
        max={seconds}
        valueText={`Sisa waktu ${formatCountdown(secondsLeft)}`}
      />

      <ul className="grid grid-cols-3 gap-2.5" aria-label="Papan kartu">
        {cards.map((card, index) => {
          const open = isOpen(index)
          const complete = matched.includes(card.symbol)

          return (
            <li key={card.id}>
              <button
                type="button"
                disabled={busy || open || flipped.length === 2}
                aria-label={
                  complete
                    ? `Kartu ${index + 1}, simbol ${card.symbol}, sudah cocok`
                    : open
                      ? `Kartu ${index + 1}, simbol ${card.symbol}`
                      : `Buka kartu ${index + 1}`
                }
                onClick={() => {
                  hapticTap()
                  setFlipped((current) => (current.length === 2 ? current : [...current, index]))
                }}
                className={cn(
                  'focus-ring transition-ui press-scale-soft relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-lg text-2xl font-black disabled:pointer-events-none motion-reduce:transition-none',
                  complete
                    ? 'bg-primary text-primary-foreground ring-1 ring-primary'
                    : open
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/50'
                      : 'bg-background/55 text-muted-foreground ring-border hover:bg-background/75 active:bg-background',
                )}
              >
                {complete ? (
                  <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary-foreground/15">
                    <GlyphCheck className="size-3" />
                  </span>
                ) : null}
                <span aria-hidden className="transition-transform duration-150 motion-reduce:transition-none">
                  {open ? card.symbol : index + 1}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-center text-xs font-medium text-muted-foreground">
        Kalau kartunya beda, dua-duanya ketutup lagi.
      </p>
    </div>
  )
}
