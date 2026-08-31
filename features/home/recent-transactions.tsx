'use client'

import { DataList, DataListAmount, DataListRow } from '@/shared/components/data-list'
import { StarRating } from '@/shared/components/star-rating'
import { DIFFICULTY_LABEL, type HistoryEntry } from '@/features/captcha/domain'
import { formatCredits, formatHistoryTime } from '@/shared/lib/format'

export function RecentTransactions({
  history,
  completedCount,
}: {
  history: HistoryEntry[]
  completedCount: number
}) {
  const isEmpty = history.length === 0
  /**
   * Tiga, bukan lima. Beranda dirancang muat dalam satu layar tanpa gulir, dan dua baris
   * terakhir adalah satu-satunya yang mendorongnya lewat — sementara riwayat lengkapnya
   * ada satu ketukan jauhnya lewat tombol Riwayat di atas maupun nav bawah.
   */
  const rows = history.slice(0, 3)

  return (
    <DataList
      label="Transaksi terakhir"
      badge={isEmpty ? undefined : `${formatCredits(completedCount)} task`}
      ariaLabel="Transaksi terakhir"
    >
      {isEmpty ? (
        <li className="py-[var(--list-row-py)] text-sm leading-relaxed text-muted-foreground text-pretty">
          Belum ada task selesai. Reward task pertama kamu bakal muncul di sini.
        </li>
      ) : null}

      {rows.map((entry, index) => (
        <DataListRow
          key={entry.id}
          showDivider={index !== rows.length - 1}
          title={entry.title}
          meta={
            <>
              {DIFFICULTY_LABEL[entry.difficulty]} ·{' '}
              <time dateTime={new Date(entry.completedAt).toISOString()}>
                {formatHistoryTime(entry.completedAt)}
              </time>
            </>
          }
          amount={
            <>
              <DataListAmount value={`+${formatCredits(entry.reward)}`} />
              <StarRating stars={entry.stars} />
            </>
          }
        />
      ))}
    </DataList>
  )
}
