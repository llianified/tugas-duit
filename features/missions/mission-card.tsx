'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MissionProgress } from '@/domain/missions'
import { MissionListSkeleton } from '@/shared/components/app-skeleton'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphBolt, GlyphCheck } from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { SectionLabel } from '@/shared/components/section-label'
import { fetchJson, sendJson, userFacingMessage } from '@/shell/api-client'
import { hapticTap } from '@/shell/haptic'
import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

type ClaimResponse = { energyGranted: number; energy: number; energyMax: number }

/**
 * Kartu ini memuat datanya sendiri, tidak menumpang `/api/session`.
 *
 * Kemajuan misi berubah setiap kali satu task selesai, sementara payload sesi dibaca
 * jauh lebih jarang. Menitipkannya di sana berarti angka misi tertinggal di belakang
 * apa yang baru saja dikerjakan user — bentuk kesalahan yang paling merusak untuk
 * sebuah daftar yang seluruh gunanya adalah menunjukkan progres.
 */
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
  const [missions, setMissions] = useState<MissionProgress[] | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ missions: MissionProgress[] }>('/api/missions')
      setMissions(data.missions)
    } catch {
      setMissions([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const claim = useCallback(
    async (key: string) => {
      hapticTap()
      setError(null)
      setClaiming(key)
      try {
        await sendJson<ClaimResponse>('/api/missions/claim', 'POST', { key })
        await Promise.all([load(), onClaimed()])
      } catch (cause) {
        setError(userFacingMessage(cause))
        await load()
      } finally {
        setClaiming(null)
      }
    },
    [load, onClaimed],
  )

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
      <div className="flex items-center justify-between gap-3">
        <SectionLabel as="h2">Misi hari ini</SectionLabel>
        <MetaBadge>
          {formatCredits(done)}/{formatCredits(missions.length)} selesai
        </MetaBadge>
      </div>

      <ul className={cn('label-gap-t flex flex-col', page ? 'gap-4' : 'gap-3')}>
        {missions.map((mission) => (
          <MissionRow
            key={mission.key}
            mission={mission}
            claiming={claiming === mission.key}
            onClaim={() => claim(mission.key)}
          />
        ))}
      </ul>

      {error ? <p className="stack-gap-t text-xs text-destructive">{error}</p> : null}
    </section>
  )
}

/**
 * Judul dan hadiah berbagi satu baris, bar progres berdiri sendiri di bawahnya.
 *
 * Bentuk sebelumnya menaruh hadiah di kolom kanan yang membentang setinggi seluruh
 * baris, sehingga ia berhenti di tengah — tidak sebaris dengan judulnya, tidak pula
 * dengan barnya. Angka progres diberi lebar minimum supaya bar setiap baris berakhir
 * di titik yang sama walau "0/5" dan "0/3" berbeda lebar.
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
  const ratio = mission.target === 0 ? 0 : Math.min(1, mission.progress / mission.target)

  return (
    <li>
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-medium',
            mission.claimed ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {mission.title}
        </p>

        <MissionAction mission={mission} claiming={claiming} onClaim={onClaim} />
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted-foreground/20"
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
        <span className="min-w-[2.5rem] shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          {formatCredits(mission.progress)}/{formatCredits(mission.target)}
        </span>
      </div>
    </li>
  )
}

function MissionAction({
  mission,
  claiming,
  onClaim,
}: {
  mission: MissionProgress
  claiming: boolean
  onClaim: () => void
}) {
  if (mission.claimed) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
        <GlyphCheck className="size-3.5" />
        Diambil
      </span>
    )
  }

  if (!mission.done) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
        <GlyphBolt className="size-3.5" />+{formatCredits(mission.reward)}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={claiming}
      aria-label={`Ambil ${formatCredits(mission.reward)} energi dari misi ${mission.title}`}
      className="focus-ring transition-ui press-scale-soft flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
    >
      <GlyphBolt className="size-3.5" />
      {claiming ? 'Mengambil…' : `+${formatCredits(mission.reward)}`}
    </button>
  )
}
