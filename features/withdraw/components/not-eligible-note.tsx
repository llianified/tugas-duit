'use client'

import { GlyphCheck, GlyphWallet } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { Surface } from '@/shared/components/surface'
import { creditsToRupiah } from '@/domain/economy/economy'
import type {
  WithdrawalGatingReason,
  WithdrawalRequirement,
} from '@/domain/economy/withdrawal'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const REQUIREMENT_LABEL: Record<WithdrawalRequirement['key'], string> = {
  balance: 'Saldo minimal',
  referrals: 'Referral aktif',
  premium: 'Premium aktif',
}

/** Sisi kanan tiap baris: progres kalau bisa dihitung, "Aktif"/"Belum" kalau ya-atau-tidak. */
function requirementValue(requirement: WithdrawalRequirement): string {
  if (requirement.key === 'premium') return requirement.done ? 'Aktif' : 'Belum'
  const current = requirement.current ?? 0
  const required = requirement.required ?? 0
  if (requirement.key === 'balance') {
    return requirement.done
      ? formatRupiah(creditsToRupiah(current))
      : `${formatRupiah(creditsToRupiah(current))} / ${formatRupiah(creditsToRupiah(required))}`
  }
  return `${formatCredits(current)} / ${formatCredits(required)}`
}

/** Sebaris keterangan untuk syarat yang belum kelar. Daftarnya sudah dipotong di gerbang itu, jadi
 * yang belum terpenuhi selalu baris terakhir — keterangannya menutup daftar, bukan menyela. */
function requirementHint(requirement: WithdrawalRequirement): string | null {
  if (requirement.done) return null
  if (requirement.key === 'balance') return 'Kerjain soal buat nambah saldo.'
  if (requirement.key === 'referrals') return 'Teman kehitung aktif setelah dia kelarin 1 soal.'
  return 'Aktifin Premium buat buka penarikan. Berlaku selama premiumnya masih aktif.'
}

/** Syarat sampai gerbang yang sedang dihadapi, dengan yang sudah lewat tetap bercentang. Yang
 * memotong daftarnya `withdrawalRequirements`, bukan komponen ini — di sini tidak ada logika
 * urutan gerbang sama sekali, cuma penyajian apa pun yang dikirim. */
export function NotEligibleNote({
  reason = 'balance',
  requirements = [],
  cooldownEndsAt = null,
  cooldownDays = null,
}: {
  reason?: WithdrawalGatingReason
  requirements?: readonly WithdrawalRequirement[]
  cooldownEndsAt?: number | null
  cooldownDays?: number | null
}) {
  /** Dua keadaan ini bukan syarat yang harus dikumpulkan, melainkan keadaan sementara — jadi
   * keduanya tetap sebuah keterangan, bukan checklist yang seolah-olah bisa dikerjakan. */
  if (reason === 'processing' || reason === 'loading' || reason === 'cooldown') {
    const title =
      reason === 'processing'
        ? 'Masih diproses'
        : reason === 'loading'
          ? 'Lagi cek syarat'
          : 'Masih kena jeda'

    return (
      <Surface as="section" aria-label={title}>
        <div className="flex items-center gap-3">
          <IconCircle tone="card">
            <GlyphWallet className="glyph-md" />
          </IconCircle>
          <p className="min-w-0 text-sm font-semibold tracking-tight">{title}</p>
        </div>
        <p className="stack-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">
          {reason === 'processing' ? (
            <>
              Pengajuan kamu yang sebelumnya masih diproses. Saldonya ditahan dulu, balik lagi kalau
              ditolak. Hasilnya kami kabari lewat bot.
            </>
          ) : reason === 'loading' ? (
            <>Bentar, lagi cek syaratnya.</>
          ) : (
            <>
              Bisa tarik lagi{' '}
              {cooldownEndsAt ? formatHistoryTime(cooldownEndsAt) : 'setelah jedanya kelar'}.{' '}
              {cooldownDays === null
                ? 'Dihitung sejak pengajuan terakhir'
                : `${formatCredits(cooldownDays)} hari sejak pengajuan terakhir`}{' '}
              dan tetap jalan meski ditolak.
            </>
          )}
        </p>
      </Surface>
    )
  }

  const firstPending = requirements.find((requirement) => !requirement.done)

  return (
    <Surface as="section" aria-label="Syarat penarikan">
      <div className="flex items-center gap-3">
        <IconCircle tone="card">
          <GlyphWallet className="glyph-md" />
        </IconCircle>
        <p className="min-w-0 text-sm font-semibold tracking-tight">Syarat penarikan</p>
      </div>

      <ul className="stack-gap-t flex flex-col gap-1.5">
        {requirements.map((requirement) => (
          <li key={requirement.key} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full',
                requirement.done ? 'bg-primary/15 text-primary' : 'ring-1 ring-border',
              )}
            >
              {requirement.done ? <GlyphCheck className="size-2.5" /> : null}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-xs',
                requirement.done ? 'text-muted-foreground' : 'font-medium text-foreground',
              )}
            >
              {REQUIREMENT_LABEL[requirement.key]}
              <span className="sr-only">{requirement.done ? ' — sudah terpenuhi' : ' — belum'}</span>
            </span>
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                requirement.done ? 'text-muted-foreground' : 'font-semibold text-foreground',
              )}
            >
              {requirementValue(requirement)}
            </span>
          </li>
        ))}
      </ul>

      {firstPending ? (
        <p className="stack-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">
          {requirementHint(firstPending)}
        </p>
      ) : null}
    </Surface>
  )
}
