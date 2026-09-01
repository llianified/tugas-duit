'use client'

import { useEffect, useRef, useState } from 'react'
import { MetaBadge } from '@/shared/components/meta-badge'
import { cn } from '@/shared/lib/utils'

export interface PinnedNoticeContent {
  title: string
  body: string
  /** Baris waktu/asal yang sudah diformat pemanggilnya. */
  meta?: string
}

/**
 * Kartu pengumuman di pucuk umpan: label "Disematkan", judul, isi terpotong tiga
 * baris, dan tautan pembuka/penutup.
 *
 * Tautannya hanya muncul kalau teksnya memang terpotong, dan itu tidak bisa
 * ditebak dari panjang string — bergantung lebar layar, ukuran font perangkat, dan
 * di mana kata-katanya putus. Jadi diukur di DOM (`scrollHeight > clientHeight`),
 * bukan diambang pada jumlah karakter.
 *
 * Hasil ukurnya **dikunci naik saja**: begitu terbuka, `clamp-3` lepas dan
 * `scrollHeight === clientHeight`, jadi mengukur ulang saat terbuka akan
 * menyimpulkan "tidak terpotong" dan menghilangkan tombol "Tutup" yang baru saja
 * dipakai orang. Karena itu pengukurannya berhenti selama terbuka, dan hanya
 * `body` baru yang mengembalikannya ke nol.
 */
export function PinnedNotice({ title, body, meta, className }: PinnedNoticeContent & { className?: string }) {
  const bodyRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [truncatable, setTruncatable] = useState(false)

  useEffect(() => {
    setExpanded(false)
    setTruncatable(false)
  }, [body])

  useEffect(() => {
    const element = bodyRef.current
    if (element === null || expanded) return

    const measure = () => {
      if (element.scrollHeight > element.clientHeight + 1) setTruncatable(true)
    }
    measure()

    /* Rotasi layar dan perubahan ukuran font Telegram mengubah titik putusnya,
    jadi satu pengukuran saat mount tidak cukup. */
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded, body])

  return (
    <article className={cn('task-card', className)} aria-label="Pengumuman disematkan">
      <div className="flex items-center gap-2">
        <MetaBadge tone="primary">Disematkan</MetaBadge>
        {meta ? (
          <span className="truncate text-[12px] text-muted-foreground">{meta}</span>
        ) : null}
      </div>

      <h3 className="mt-2 text-[15px] font-bold tracking-tight text-balance">{title}</h3>

      <p
        ref={bodyRef}
        className={cn(
          'mt-1 text-[13px] leading-relaxed whitespace-pre-line text-muted-foreground',
          !expanded && 'clamp-3',
        )}
      >
        {body}
      </p>

      {truncatable ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          /* Tingginya 44px demi target sentuh, dan `-mb-2` menyerap kelebihan
          tinggi itu supaya kartunya tidak tampak berpadding ganda di bawah. */
          className="focus-ring transition-ui -mb-2 inline-flex min-h-11 items-center rounded-md text-[13px] font-semibold text-primary"
        >
          {expanded ? 'Tutup' : 'Baca selengkapnya'}
        </button>
      ) : null}
    </article>
  )
}
