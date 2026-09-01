'use client'

import type { MissionProgress } from '@/domain/missions'
import { useMissions } from '@/features/missions/use-missions'
import { MissionListSkeleton } from '@/shared/components/app-skeleton'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphBolt, GlyphCheck } from '@/shared/components/glyph'
import { SectionLabel } from '@/shared/components/section-label'
import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export function MissionCard({
  refreshKey,
  onClaimed,
  variant = 'card',
}: {
  refreshKey: number
  onClaimed: () => Promise<unknown>
  /**
   * `page` dipakai saat daftar ini menjadi isi utama sebuah view, bukan satu kartu
   * di antara kartu lain. Permukaan `--muted` dilepas — kartu di dalam halaman yang
   * seluruhnya tentang misi hanya menambah satu kotak tanpa memisahkan apa pun —
   * dan daftar kosong berhenti mengembalikan `null`, karena view yang kosong total
   * adalah jalan buntu sementara kartu yang hilang dari Beranda bukan.
   */
  variant?: 'card' | 'page'
}) {
  const { missions, claiming, claim } = useMissions({ refreshKey, onClaimed })
  const page = variant === 'page'

  /**
   * Di Beranda daftar ini satu kartu di antara kartu lain, jadi ia boleh tidak ada
   * sampai datanya masuk. Sebagai isi utama view Misi ia tidak boleh: kerangka app
   * sudah menghilang, dan `/api/missions` dimuat terpisah dari `/api/session`, jadi
   * halamannya berhenti di paragraf "Cara kerjanya" tanpa tanda apa pun sedang jalan.
   */
  if (!missions) return page ? <MissionListSkeleton surface={false} /> : null

  if (missions.length === 0) {
    if (!page) return null
    return (
      <EmptyState
        icon={<GlyphCheck className="glyph-md text-muted-foreground" />}
        title="Belum ada misi hari ini"
        description="Misi baru terbit setiap hari. Selesaikan task dulu, misinya bakal muncul di sini."
      />
    )
  }

  const done = missions.filter((mission) => mission.claimed).length

  return (
    <section
      aria-label="Misi harian"
      className={page ? undefined : 'rounded-lg bg-muted/60 p-[var(--surface-p)] ring-border'}
    >
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel as="h2">Misi hari ini</SectionLabel>
        {/* Kata "selesai" dibuang: label di sebelahnya sudah menyebut misi, dan rasio
            bertanda tabular terbaca sendiri tanpa perlu dijelaskan. */}
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {formatCredits(done)}
          <span aria-hidden="true">/</span>
          <span className="sr-only"> dari </span>
          {formatCredits(missions.length)}
        </span>
      </div>

      <ul className={cn('label-gap-t flex flex-col', page ? 'gap-3' : 'gap-2.5')}>
        {missions.map((mission) => (
          <MissionRow
            key={mission.key}
            mission={mission}
            claiming={claiming === mission.key}
            onClaim={() => claim(mission.key)}
          />
        ))}
      </ul>
    </section>
  )
}

/**
 * Satu misi = satu baris: judul, meter segmen, lalu satu slot aksi.
 *
 * Bentuk sebelumnya menumpuk empat hal per misi — judul, chip hadiah, bar progres, dan
 * angka "0/5" — sehingga tiga misi saja sudah menjadi dua belas potong teks dan angka.
 * Meter segmen menggantikan pasangan bar + angka: target misi selalu 3–5, jadi jumlah
 * kotaknya bisa dihitung sekali lihat, dan rasio persisnya tetap ada untuk pembaca layar
 * lewat `aria-valuetext`. Lebar meter dan slot aksi dipatok supaya ketiga baris berhenti
 * di kolom yang sama, apa pun panjang judul dan status misinya.
 */
function MissionRow({
  mission,
  claiming,
  onClaim,
}: {
  mission: MissionProgress
  claiming: boolean
  onClaim: () => void
}) {
  return (
    <li className="flex items-center gap-2.5">
      <p
        className={cn(
          'min-w-0 flex-1 truncate text-[13px] font-medium',
          mission.claimed ? 'text-muted-foreground line-through' : 'text-foreground',
        )}
      >
        {mission.title}
      </p>

      <MissionMeter
        progress={mission.progress}
        target={mission.target}
        muted={mission.claimed}
        className="w-14 shrink-0"
      />

      <MissionAction mission={mission} claiming={claiming} onClaim={onClaim} />
    </li>
  )
}

function MissionMeter({
  progress,
  target,
  muted,
  className,
}: {
  progress: number
  target: number
  muted: boolean
  className?: string
}) {
  const filled = Math.max(0, Math.min(target, progress))

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={filled}
      aria-valuetext={`${formatCredits(filled)} dari ${formatCredits(target)}`}
      className={cn('flex items-center gap-1', className)}
    >
      {Array.from({ length: Math.max(1, target) }, (_, index) => (
        <span key={index} className="meter-h flex-1 overflow-hidden rounded-full bg-border">
          {index < filled ? (
            <span
              className={cn(
                'block h-full rounded-full transition-colors duration-300 ease-out motion-reduce:transition-none',
                muted ? 'bg-muted-foreground/40' : 'bg-primary',
              )}
            />
          ) : null}
        </span>
      ))}
    </div>
  )
}

/**
 * Slot aksi dengan lebar minimum yang sama untuk ketiga statusnya, supaya baris misi
 * yang sudah diambil tidak menggeser kolom baris di atas dan bawahnya.
 */
function MissionAction({
  mission,
  claiming,
  onClaim,
}: {
  mission: MissionProgress
  claiming: boolean
  onClaim: () => void
}) {
  const slot = 'flex h-7 min-w-[3.25rem] shrink-0 items-center justify-end gap-1 text-xs'

  if (mission.claimed) {
    return (
      <span className={cn(slot, 'font-medium text-muted-foreground')}>
        <GlyphCheck className="size-3.5" />
        <span className="sr-only">Hadiah sudah diambil</span>
      </span>
    )
  }

  if (!mission.done) {
    return (
      <span className={cn(slot, 'font-medium tabular-nums text-muted-foreground')}>
        <GlyphBolt className="size-3.5" />+{formatCredits(mission.reward)}
      </span>
    )
  }

  return (
    <div className={cn(slot, 'justify-end')}>
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming}
        aria-label={`Ambil ${formatCredits(mission.reward)} energi dari misi ${mission.title}`}
        className="focus-ring transition-ui press-scale-soft flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold tabular-nums text-primary-foreground"
      >
        <GlyphBolt className="size-3.5" />
        {claiming ? '…' : `+${formatCredits(mission.reward)}`}
      </button>
    </div>
  )
}
