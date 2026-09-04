'use client'

import { useState } from 'react'
import type { MissionProgress } from '@/domain/progression/missions'
import { SocialMissionSheet } from '@/features/missions/social-mission-sheet'
import { useMissions } from '@/features/missions/use-missions'
import { MissionListSkeleton } from '@/shared/components/app-skeleton'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphBolt, GlyphCheck, GlyphSpinner } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { SectionLabel } from '@/shared/components/section-label'
import { SURFACE_CARD_CLASS } from '@/shared/components/surface-card'
import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export function MissionCard({
  refreshKey,
  onClaimed,
  botAppUrl,
  variant = 'card',
}: {
  refreshKey: number
  onClaimed: () => Promise<unknown>
  botAppUrl: string | null
  /** `page` dipakai saat daftar ini menjadi isi utama sebuah view, jadi permukaan kartu luar dilepas. */
  variant?: 'card' | 'page'
}) {
  const { missions, clock, claiming, starting, startAction, claim } = useMissions({
    refreshKey,
    onClaimed,
  })
  const [socialMissionKey, setSocialMissionKey] = useState<string | null>(null)
  const page = variant === 'page'
  const selectedMission = missions?.find((mission) => mission.key === socialMissionKey) ?? null

  if (!missions) return page ? <MissionListSkeleton surface={false} /> : null

  if (missions.length === 0) {
    if (!page) return null
    return (
      <EmptyState
        icon={<GlyphCheck className="glyph-md text-muted-foreground" />}
        title="Belum ada misi"
        description="Mulai kerjakan task. Misinya bakal muncul di sini."
      />
    )
  }

  const done = missions.filter((mission) => mission.claimed).length

  return (
    <>
      <section aria-label="Misi harian" className={page ? undefined : SURFACE_CARD_CLASS}>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel as="h2">Misi hari ini</SectionLabel>
          <MetaBadge>
            {formatCredits(done)}
            <span aria-hidden="true">/</span>
            <span className="sr-only"> dari </span>
            {formatCredits(missions.length)}
          </MetaBadge>
        </div>

        <ul className={cn('label-gap-t flex flex-col', page ? 'gap-3' : 'gap-2.5')}>
          {missions.map((mission) => (
            <MissionRow
              key={mission.key}
              mission={mission}
              claiming={claiming === mission.key}
              onClaim={() => void claim(mission.key)}
              onOpenSocial={() => setSocialMissionKey(mission.key)}
            />
          ))}
        </ul>
      </section>

      {selectedMission?.kind === 'social' ? (
        <SocialMissionSheet
          key={selectedMission.key}
          mission={selectedMission}
          clock={clock}
          botAppUrl={botAppUrl}
          starting={starting === selectedMission.key}
          claiming={claiming === selectedMission.key}
          onOpenChange={(open) => {
            if (!open) setSocialMissionKey(null)
          }}
          onStart={() => startAction(selectedMission.key)}
          onConfirm={() => claim(selectedMission.key)}
        />
      ) : null}
    </>
  )
}

/** Misi otomatis mempertahankan meter segmen; misi sosial mengganti meter dengan label frekuensi supaya baris tidak menyiratkan progres yang sebenarnya tidak bisa dibaca dari platform sosial. */
function MissionRow({
  mission,
  claiming,
  onClaim,
  onOpenSocial,
}: {
  mission: MissionProgress
  claiming: boolean
  onClaim: () => void
  onOpenSocial: () => void
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

      {mission.kind === 'automatic' ? (
        <MissionMeter
          progress={mission.progress}
          target={mission.target}
          muted={mission.claimed}
          className="w-14 shrink-0"
        />
      ) : (
        <span className="w-14 shrink-0 text-center text-[11px] font-medium text-muted-foreground">
          {mission.cadence === 'once' ? 'Sekali' : 'Harian'}
        </span>
      )}

      <MissionAction
        mission={mission}
        claiming={claiming}
        onClaim={onClaim}
        onOpenSocial={onOpenSocial}
      />
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

/** Slot aksi selalu punya ukuran yang sama, sehingga status selesai dan proses klaim tidak menggeser kolom daftar. Untuk misi sosial, tombol reward membuka petunjuk dan cooldown konfirmasi. */
function MissionAction({
  mission,
  claiming,
  onClaim,
  onOpenSocial,
}: {
  mission: MissionProgress
  claiming: boolean
  onClaim: () => void
  onOpenSocial: () => void
}) {
  const slot = 'flex h-8 min-w-[3.75rem] shrink-0 items-center justify-end'
  const box =
    'btn-label relative flex h-8 items-center gap-1 rounded-md px-2.5 font-bold tabular-nums'

  if (mission.claimed) {
    return (
      <div className={slot}>
        <button
          type="button"
          disabled
          aria-label={`Hadiah misi ${mission.title} sudah diambil`}
          className={cn(box, 'bg-muted text-muted-foreground')}
        >
          <GlyphCheck className="size-3.5" />+{formatCredits(mission.reward)}
        </button>
      </div>
    )
  }

  if (mission.kind === 'social') {
    return (
      <div className={slot}>
        <button
          type="button"
          onClick={onOpenSocial}
          aria-label={`Jalankan misi ${mission.title} untuk mendapat ${formatCredits(mission.reward)} energi`}
          className={cn(
            box,
            'focus-ring transition-ui press-scale-soft btn-glass bg-primary text-primary-foreground',
          )}
        >
          <GlyphBolt className="size-3.5" />+{formatCredits(mission.reward)}
        </button>
      </div>
    )
  }

  if (!mission.done) {
    return (
      <div className={slot}>
        <button
          type="button"
          disabled
          aria-label={`Hadiah misi ${mission.title} belum bisa diambil, selesaikan dulu`}
          className={cn(box, 'btn-glass-quiet text-muted-foreground')}
        >
          <GlyphBolt className="size-3.5" />+{formatCredits(mission.reward)}
        </button>
      </div>
    )
  }

  return (
    <div className={slot}>
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming}
        aria-busy={claiming}
        aria-label={`Ambil ${formatCredits(mission.reward)} energi dari misi ${mission.title}`}
        className={cn(
          box,
          'focus-ring transition-ui press-scale-soft btn-glass bg-primary text-primary-foreground',
        )}
      >
        <span aria-hidden={claiming} className={cn('flex items-center gap-1', claiming && 'invisible')}>
          <GlyphBolt className="size-3.5" />+{formatCredits(mission.reward)}
        </span>
        {claiming ? (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <GlyphSpinner className="size-3.5 animate-spin motion-reduce:animate-none" />
          </span>
        ) : null}
      </button>
    </div>
  )
}
