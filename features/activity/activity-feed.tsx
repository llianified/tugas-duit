'use client'

import type { ActivityEntry } from '@/features/activity/domain'
import { ProfileAvatar } from '@/features/home/profile-avatar'
import { DIFFICULTY_LABEL, type Difficulty } from '@/features/captcha/domain'
import { DataListSkeleton } from '@/shared/components/app-skeleton'
import { DataList } from '@/shared/components/data-list'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphBolt } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Jarak ke baris tab dibawa tiap cabang sendiri, bukan oleh pembungkus di `LeaderboardView`. `EmptyState` memusatkan dirinya lewat `flex-1 justify-center`, jadi ia butuh tinggi sisa view — dan margin atas apa pun di atasnya menggeser titik pusat itu ke bawah, membuat posisinya beda dari empty state tab Papan yang duduk langsung sebagai anak `view-min-h`. Daftar dan kerangkanya tetap butuh jaraknya. Umpan ini tidak punya slot pengumuman tersemat. Satu-satunya sumber pengumuman di repo ini adalah tabel `broadcasts`, yang isinya pesan Telegram bersegmen dan tidak layak disiarkan ke semua orang — lihat catatan Langkah 11 di `docs/rencana-gaya-fomo.md`. */
export function ActivityFeed({ entries }: { entries: ActivityEntry[] | null }) {
  if (entries === null) {
    return (
      <div className="region-under-brand">
        <DataListSkeleton marker />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<GlyphBolt className="size-5" />}
        title="Belum ada aktivitas"
        description="Task bintang tiga dan penarikan yang sudah dibayar bakal muncul di sini."
      />
    )
  }

  return (
    <div className="region-under-brand">
      {/* Judulnya disembunyikan, bukan diganti: tab "Aktivitas" yang aktif tepat di atas daftar ini sudah menamainya, dan "Aktivitas terbaru" cuma mengulangnya sekali lagi dua baris di bawah. Namanya tetap hidup di `label`/`ariaLabel` untuk pembaca layar. */}
      <DataList label="Aktivitas terbaru" ariaLabel="Aktivitas semua pemain" hideLabel>
        {entries.map((entry, index) => (
          <FeedItem key={entry.id} entry={entry} showDivider={index < entries.length - 1} />
        ))}
      </DataList>
    </div>
  )
}

/** Satu item umpan bergaya thread: kolom avatar di kiri atas, lalu garis penghubung berbentuk L (`.thread-line`) yang turun dari bawah avatar dan menikung ke isi. Angka geometrinya saling terikat dan tidak boleh diubah sendiri-sendiri: avatar `size-10` (2.5rem) berarti sumbu tengahnya di 1.25rem, jadi blok isi digeser `ml-5` supaya garis vertikalnya jatuh tepat di tengah avatar. `pl-5` di sisi lain adalah 0.75rem lebar tikungan `.thread-line` + 0.5rem jarak baca. Nilainya pindah ke dalam blok isi, bukan menempel di tepi kanan seperti baris `DataListRow`: pada 384px tepi kanan sudah dipakai waktu, dan menaruh keduanya di sana memotong nama orangnya. Ini juga yang dilakukan fomo — harga duduk di badan pesan, bukan di kolom kanan. */
function FeedItem({ entry, showDivider }: { entry: ActivityEntry; showDivider: boolean }) {
  const payout = entry.kind === 'payout'

  return (
    <li
      className={cn(
        'bleed-x transition-ui flex flex-col py-[var(--list-row-py)] hover:bg-muted/60',
        showDivider && 'border-b border-border/60',
      )}
    >
      <div className="flex items-center gap-2.5">
        <ProfileAvatar
          photoUrl={entry.photoUrl}
          className="size-10 ring-border"
          glyphClassName="size-4"
        />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
          {entry.displayName}
        </span>
        {payout ? (
          <MetaBadge tone="primary">Cair</MetaBadge>
        ) : (
          <MetaBadge>{difficultyLabel(entry.difficulty)}</MetaBadge>
        )}
        <span className="shrink-0 text-[12px] text-muted-foreground">
          {formatHistoryTime(entry.at)}
        </span>
      </div>

      {/* Tanpa margin atas: tepi atas blok ini harus persis tepi bawah avatar, karena `.thread-line::before` menggambar garisnya dari `top: 0`. `pt-2` memberi tinggi pada bagian vertikalnya — tikungannya sendiri jatuh `0.5rem` di atas tepi bawah blok, jadi ia mendarat di tengah baris teks. */}
      <div className="thread-line ml-5 pt-2 pl-5">
        <p className="text-[13px] leading-relaxed">
          <span className="font-bold tabular-nums text-success">
            {payout ? formatRupiah(entry.amount) : `+${formatCredits(entry.amount)} credit`}
          </span>
          <span className="text-muted-foreground">
            {payout ? ' · penarikan dibayar' : ' · task bintang tiga'}
          </span>
        </p>
      </div>
    </li>
  )
}

function difficultyLabel(value: string | null): string {
  if (value === null) return 'Task'
  return DIFFICULTY_LABEL[value as Difficulty] ?? value
}
