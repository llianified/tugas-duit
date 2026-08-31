'use client'

import { useMemo } from 'react'
import {
  BINDING_LABEL,
  BINDING_NOTE,
  projectEarnings,
  type EarningsProjection,
} from '@/domain/earnings-projection'
import type { EconomyConfig } from '@/domain/economy-config'
import { MetaBadge } from '@/shared/components/meta-badge'
import { SectionLabel } from '@/shared/components/section-label'
import { Surface } from '@/shared/components/surface'
import { formatCredits, formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const credits = (value: number) => formatCredits(Math.round(value))

/**
 * Panel setelan ekonomi menampilkan angka mentah — "kapasitas kolam 3000", "isi ulang tiap
 * 48 menit" — dan tidak satu pun menjawab pertanyaan yang sebenarnya ditanyakan sebelum
 * menekan Terapkan: dengan setelan ini, user bisa dapat berapa.
 *
 * Proyeksi dihitung dari draf yang sedang diketik, bukan dari config tersimpan, supaya
 * akibatnya kelihatan sebelum disimpan. Kolom "tersimpan → draf" muncul hanya untuk baris
 * yang benar-benar berubah.
 */
export function EarningsPreview({
  saved,
  draft,
}: {
  saved: EconomyConfig
  draft: EconomyConfig
}) {
  const before = useMemo(() => projectEarnings(saved), [saved])
  const after = useMemo(() => projectEarnings(draft), [draft])
  const changed = before.totalRupiahPerDay !== after.totalRupiahPerDay

  return (
    <Surface tone="solid" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel as="h2">Perkiraan penghasilan user</SectionLabel>
        <MetaBadge tone={after.binding === 'kolam' ? 'muted' : 'accent'}>
          Pengikat: {BINDING_LABEL[after.binding]}
        </MetaBadge>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {formatRupiah(after.totalRupiahPerDay)}
        </span>
        <span className="text-xs text-muted-foreground">maksimum per user per hari</span>
        {changed ? (
          <Delta before={before.totalRupiahPerDay} after={after.totalRupiahPerDay} />
        ) : null}
      </div>

      <dl className="flex flex-col gap-1.5">
        <Row
          label="Dari task sendiri"
          value={`${credits(after.taskCreditsPerDay)} credit · ${formatRupiah(after.taskRupiahPerDay)}`}
          changed={before.taskRupiahPerDay !== after.taskRupiahPerDay}
          previous={`${credits(before.taskCreditsPerDay)} credit · ${formatRupiah(before.taskRupiahPerDay)}`}
        />
        <Row
          label="Komisi referral (plafon)"
          value={`${credits(after.commissionCreditsPerDay)} credit · ${formatRupiah(after.commissionRupiahPerDay)}`}
          changed={before.commissionRupiahPerDay !== after.commissionRupiahPerDay}
          previous={`${credits(before.commissionCreditsPerDay)} credit · ${formatRupiah(before.commissionRupiahPerDay)}`}
        />
        <Row
          label="Sebulan (30 hari)"
          value={formatRupiah(after.totalRupiahPerMonth)}
          changed={before.totalRupiahPerMonth !== after.totalRupiahPerMonth}
          previous={formatRupiah(before.totalRupiahPerMonth)}
        />
        <Row
          label="Saldo cukup ditarik"
          value={`${credits(after.daysToWithdrawalBalance)} hari · ${credits(after.withdrawalMinimumCredits)} credit`}
          changed={before.daysToWithdrawalBalance !== after.daysToWithdrawalBalance}
          previous={`${credits(before.daysToWithdrawalBalance)} hari`}
        />
        <Row
          label="Kapasitas kolam"
          value={`${credits(after.poolCapacityBase)} → ${credits(after.poolCapacityMax)} credit`}
          changed={before.poolCapacityMax !== after.poolCapacityMax}
          previous={`${credits(before.poolCapacityBase)} → ${credits(before.poolCapacityMax)}`}
        />
        <Row
          label="Sanggup dikerjakan"
          value={`${credits(after.taskCapPerDay)} task/hari · maks ${credits(after.taskCeilingCredits)} credit`}
          changed={before.taskCapPerDay !== after.taskCapPerDay}
          previous={`${credits(before.taskCapPerDay)} task/hari`}
        />
      </dl>

      <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
        {BINDING_NOTE[after.binding]}
      </p>

      <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
        Angka di atas plafon, bukan rata-rata: user harus memanen kolamnya sampai habis setiap
        hari untuk mencapainya. Gerbang penarikan pertama tetap hari aktif dan referral aktif,
        bukan saldo — lihat grup Penarikan.
      </p>
    </Surface>
  )
}

function Row({
  label,
  value,
  changed,
  previous,
}: {
  label: string
  value: string
  changed: boolean
  previous: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-1.5 text-right tabular-nums">
        {changed ? <span className="text-muted-foreground line-through">{previous}</span> : null}
        <span className={cn('font-semibold', changed ? 'text-primary' : 'text-foreground')}>
          {value}
        </span>
      </dd>
    </div>
  )
}

function Delta({ before, after }: { before: number; after: number }) {
  const up = after > before
  const percent = before === 0 ? null : Math.round(((after - before) / before) * 100)

  return (
    <MetaBadge tone="accent" className={up ? 'text-destructive' : 'text-success'}>
      {up ? '+' : '−'}
      {formatRupiah(Math.abs(after - before))}
      {percent === null ? '' : ` · ${up ? '+' : ''}${formatCredits(percent)}%`}
    </MetaBadge>
  )
}

export type { EarningsProjection }
