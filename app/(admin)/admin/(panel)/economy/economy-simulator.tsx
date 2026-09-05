'use client'

/** Simulator ekonomi: apa yang terjadi pada tiap segmen user kalau draf ini disimpan.
 *
 * Menghitung dari `draft`, bukan dari config tersimpan, supaya angkanya bergerak saat satu field
 * diketik — sebelum ada yang disimpan. Itu seluruh gunanya: menyetel ekonomi berhenti jadi
 * "simpan dulu, lihat besok".
 *
 * Yang ditampilkan bukan cuma hasil, tapi **pengikat** tiap segmen — field mana yang benar-benar
 * menahan mereka. Tanpa itu, cara paling mudah membakar uang tanpa menambah satu sesi pun adalah
 * menaikkan plafon yang memang tidak pernah tersentuh: 75% user berhenti karena tangki energi,
 * dan kolam reward mereka tidak pernah mentok sekali pun.
 */

import { useMemo } from 'react'
import { formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import {
  validateEconomyConfig,
  type EconomyConfig,
  type EconomyConfigKey,
} from '@/domain/economy/economy-config'
import {
  averageReward,
  poolCreditsPerDay,
  projectEconomy,
  type Bottleneck,
  type SegmentProjection,
} from '@/domain/economy/economy-projection'

/** Field yang harus disorot admin untuk melonggarkan pengikat tersebut. Dipakai supaya panel
 * menjawab "lalu saya harus ubah apa", bukan cuma "ini yang menahan". */
const BOTTLENECK_FIX: Record<Bottleneck, string> = {
  'tangki energi': 'Kapasitas energi',
  'regen energi': 'Interval regen energi',
  iklan: 'Tayangan iklan per hari',
  'plafon harian': 'Batas task harian',
  'stok reward': 'Isi ulang kolam',
}

const round = (value: number) => Math.round(value * 10) / 10

function Delta({ from, to, unit = '' }: { from: number; to: number; unit?: string }) {
  const diff = to - from
  if (Math.abs(diff) < 0.05) return null
  return (
    <span className={cn('text-[11px] font-medium', diff > 0 ? 'text-primary' : 'text-destructive')}>
      {diff > 0 ? '+' : '−'}
      {unit === 'Rp' ? formatRupiah(Math.abs(diff)) : round(Math.abs(diff))}
      {unit && unit !== 'Rp' ? ` ${unit}` : ''}
    </span>
  )
}

function SegmentRow({ now, next }: { now: SegmentProjection; next: SegmentProjection }) {
  return (
    <li className="rounded-xl bg-background p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{next.profile.label}</span>
        <span className="text-[11px] text-muted-foreground">
          {Math.round(next.profile.shareOfUsers * 100)}% user
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2 tabular-nums">
        <div>
          <p className="text-sm font-semibold text-foreground">{formatRupiah(next.rupiahPerDay)}</p>
          <p className="text-[11px] text-muted-foreground">
            per hari <Delta from={now.rupiahPerDay} to={next.rupiahPerDay} unit="Rp" />
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{round(next.tasksPerDay)}</p>
          <p className="text-[11px] text-muted-foreground">
            task <Delta from={now.tasksPerDay} to={next.tasksPerDay} />
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {round(next.activeMinutesPerDay)} mnt
          </p>
          <p className="text-[11px] text-muted-foreground">
            main <Delta from={now.activeMinutesPerDay} to={next.activeMinutesPerDay} />
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Tertahan <span className="font-medium text-foreground">{next.bottleneck}</span>
        {' · naikkan '}
        <span className="font-medium text-foreground">{BOTTLENECK_FIX[next.bottleneck]}</span>
        {next.daysToWithdrawal === null
          ? ' · tidak pernah sampai ambang tarik'
          : ` · tarik pertama ${next.daysToWithdrawal} hari`}
      </p>
    </li>
  )
}

export function EconomySimulator({
  saved,
  draft,
  activeUsers,
}: {
  saved: EconomyConfig
  /** Nilai mentah dari form, termasuk yang belum jadi angka sah. */
  draft: Record<EconomyConfigKey, string>
  /** Jumlah user aktif harian, dipakai menaikkan angka per-user jadi angka kas. */
  activeUsers: number
}) {
  const projected = useMemo(() => {
    const parsed = validateEconomyConfig(
      Object.fromEntries(
        Object.entries(draft).map(([key, value]) => [key, value.trim() === '' ? NaN : Number(value)]),
      ),
    )
    return parsed.ok ? parsed.config : null
  }, [draft])

  const now = useMemo(() => projectEconomy(saved), [saved])
  const next = useMemo(() => (projected ? projectEconomy(projected) : null), [projected])

  if (!next || !projected) {
    return (
      <section className="rounded-xl bg-muted p-3">
        <h3 className="text-sm font-semibold text-foreground">Proyeksi</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Ada field yang belum berupa angka sah, jadi proyeksinya ditahan. Perbaiki dulu isinya.
        </p>
      </section>
    )
  }

  const monthlyBurn = next.averageRupiahPerDay * activeUsers * 30
  const monthlyBurnNow = now.averageRupiahPerDay * activeUsers * 30

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-muted p-3">
      <header>
        <h3 className="text-sm font-semibold text-foreground">Proyeksi draf ini</h3>
        <p className="text-[11px] text-muted-foreground">
          Segmen dikalibrasi dari {activeUsers} user aktif. Angka bergerak saat kamu mengetik —
          belum ada yang tersimpan.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-2 tabular-nums">
        <li className="rounded-xl bg-background p-2.5">
          <p className="text-base font-semibold text-foreground">
            {formatRupiah(next.averageRupiahPerDay)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            rata-rata per user{' '}
            <Delta from={now.averageRupiahPerDay} to={next.averageRupiahPerDay} unit="Rp" />
          </p>
        </li>
        <li className="rounded-xl bg-background p-2.5">
          <p className="text-base font-semibold text-foreground">{formatRupiah(monthlyBurn)}</p>
          <p className="text-[11px] text-muted-foreground">
            akrual sebulan <Delta from={monthlyBurnNow} to={monthlyBurn} unit="Rp" />
          </p>
        </li>
        <li className="rounded-xl bg-background p-2.5">
          <p className="text-base font-semibold text-foreground">
            {formatRupiah(next.maxRupiahPerDay)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            plafon satu akun <Delta from={now.maxRupiahPerDay} to={next.maxRupiahPerDay} unit="Rp" />
          </p>
        </li>
        <li className="rounded-xl bg-background p-2.5">
          <p className="text-base font-semibold text-foreground">
            {round(averageReward(projected))} cr
          </p>
          <p className="text-[11px] text-muted-foreground">
            reward per task <Delta from={averageReward(saved)} to={averageReward(projected)} />
          </p>
        </li>
      </ul>

      <ul className="flex flex-col gap-2">
        {next.segments.map((segment, index) => (
          <SegmentRow key={segment.profile.id} now={now.segments[index]} next={segment} />
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Kolam mengisi {round(poolCreditsPerDay(projected))} credit/hari — plafon, bukan perkiraan.
        Selama tidak ada segmen yang tertahan <span className="font-medium">stok reward</span>,
        menaikkannya tidak menambah satu task pun.
      </p>
    </section>
  )
}
