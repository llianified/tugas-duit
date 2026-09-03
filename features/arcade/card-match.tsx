'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MATCH_PAIRS } from '@/domain/arcade/arcade'
import { formatCountdown } from '@/shared/lib/format'
import { hapticTap } from '@/shared/lib/haptic'
import { ProgressBar } from '@/shared/components/progress-bar'
import { cn } from '@/shared/lib/utils'

/** Enam kartu, tiga pasang. Lambangnya teks, bukan glyph Tabler: yang dibandingkan mata di sini adalah bentuk yang sangat berbeda satu sama lain, dan tiga ikon bergaris tipis dengan bobot yang mirip justru membuat rondenya soal ketelitian melihat, bukan soal mengingat. */
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">
          Cocokkan {MATCH_PAIRS} pasang
        </p>
        <p
          aria-live="off"
          className="text-[13px] font-bold tabular-nums text-foreground"
        >
          {formatCountdown(secondsLeft)}
        </p>
      </div>

      <ProgressBar
        value={secondsLeft}
        max={seconds}
        valueText={`Sisa waktu ${formatCountdown(secondsLeft)}`}
      />

      <ul className="grid grid-cols-3 gap-2.5" aria-label="Papan kartu">
        {cards.map((card, index) => {
          const open = isOpen(index)
          return (
            <li key={card.id}>
              <button
                type="button"
                disabled={busy || open || flipped.length === 2}
                aria-label={open ? `Kartu ${card.symbol}` : `Buka kartu ${index + 1}`}
                onClick={() => {
                  hapticTap()
                  setFlipped((current) => (current.length === 2 ? current : [...current, index]))
                }}
                className={cn(
                  'focus-ring transition-ui press-scale-soft flex aspect-square w-full items-center justify-center rounded-lg text-2xl font-black disabled:pointer-events-none',
                  open
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                    : 'bg-muted/60 text-transparent hover:bg-muted active:bg-muted',
                )}
              >
                <span aria-hidden>{open ? card.symbol : '?'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
