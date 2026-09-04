'use client'

import { DataList, DataListAmount, DataListRow } from '@/shared/components/data-list'
import { StarRating } from '@/shared/components/star-rating'
import { DIFFICULTY_LABEL, type HistoryEntry } from '@/domain/task/challenge'
import { formatCredits, formatHistoryTime } from '@/shared/lib/format'

export function RecentTransactions({
  history,
  onSeeAll,
}: {
  history: HistoryEntry[]
  onSeeAll: () => void
}) {
  const isEmpty = history.length === 0
  /** Tiga, bukan lima. Beranda dirancang muat dalam satu layar tanpa gulir, dan dua baris terakhir adalah satu-satunya yang mendorongnya lewat — sementara riwayat lengkapnya ada satu ketukan jauhnya lewat tautan Riwayat di kepala daftar ini. */
  const rows = history.slice(0, 3)

  return (
    <DataList
      label="Transaksi terakhir"
      /* Chip "N task" dilepas. Angka yang dibawanya adalah TOTAL task selesai seumur akun, sementara daftar di bawahnya cuma tiga baris terakhir — dua bilangan berbeda yang duduk berdampingan seolah satu, dan chip itu pula yang menekan tautan aksi ke pinggir. Totalnya masih utuh di Profil dan Statistik, tempatnya memang di sana. */
      action={
        isEmpty ? undefined : (
          /* "Lihat semua", bukan "Riwayat": yang dijanjikan tautan ini adalah sisa dari daftar yang sedang dibaca, dan kalimat itu menyebutnya langsung. "Riwayat" adalah nama halaman tujuan — ia menuntut user sudah tahu halaman itu berisi apa. */
          <button
            type="button"
            onClick={onSeeAll}
            className="focus-ring transition-ui rounded-sm text-[13px] font-semibold text-primary hover:underline"
          >
            Lihat semua
          </button>
        )
      }
      ariaLabel="Transaksi terakhir"
    >
      {isEmpty ? (
        <li className="py-[var(--list-row-py)] text-sm leading-relaxed text-muted-foreground text-pretty">
          Belum ada transaksi. Reward task pertama muncul di sini.
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
