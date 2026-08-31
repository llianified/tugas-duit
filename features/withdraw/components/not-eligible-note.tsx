'use client'

import { GlyphCheck, GlyphWallet } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { Surface } from '@/shared/components/surface'
import {
  creditsToRupiah,
  firstWithdrawalEstimateDays,
  withdrawalMinimumCredits,
} from '@/domain/economy'
import { formatCredits, formatHistoryTime, formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export type GatingReason = 'balance' | 'days' | 'referrals' | 'cooldown' | 'pending' | 'loading'

const TITLE: Record<GatingReason, string> = {
  balance: 'Belum bisa ditarik',
  loading: 'Lagi ngecek syaratnya',
  days: 'Hari aktifnya belum cukup',
  referrals: 'Referral belum cukup',
  cooldown: 'Masih cooldown',
  pending: 'Pengajuan kamu masih diproses',
}

export function NotEligibleNote({
  reason = 'balance',
  balance = 0,
  activeReferralCount = 0,
  requiredActiveReferrals = 5,
  cooldownEndsAt = null,
  cooldownDays = null,
  activeDays = 0,
  requiredActiveDays = 7,
}: {
  reason?: GatingReason
  balance?: number
  activeReferralCount?: number
  requiredActiveReferrals?: number
  cooldownEndsAt?: number | null
  cooldownDays?: number | null
  activeDays?: number
  requiredActiveDays?: number
}) {
  const minimum = withdrawalMinimumCredits()

  return (
    <Surface as="section" aria-label={TITLE[reason]}>
      <div className="flex items-center gap-3">
        <IconCircle tone="card">
          <GlyphWallet className="glyph-md" />
        </IconCircle>
        <p className="min-w-0 text-sm font-semibold tracking-tight">{TITLE[reason]}</p>
      </div>

      <p className="stack-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">
        {reason === 'balance' ? (
          <>
            Nabung dulu sampai {formatRupiah(creditsToRupiah(minimum))} ya, baru penarikannya
            kebuka. Dengan laju isi ulang stok reward sekarang, saldo segitu biasanya kekejar
            sekitar {firstWithdrawalEstimateDays()} hari aktif.
          </>
        ) : reason === 'loading' ? (
          <>Bentar ya, kami lagi ngecek syarat penarikan kamu.</>
        ) : reason === 'days' ? (
          <>
            Satu hari kehitung aktif kalau ada minimal 1 task yang kelar — nggak harus
            berturut-turut, jadi bolong sehari nggak ngulang dari nol.
          </>
        ) : reason === 'referrals' ? (
          <>Teman kamu baru kehitung aktif setelah dia ngerjain minimal 1 task.</>
        ) : reason === 'pending' ? (
          <>
            Satu pengajuan diproses dulu sampai selesai sebelum kamu bisa mengajukan lagi. Statusnya
            ada di daftar bawah — begitu dibayar atau ditolak, tombolnya kebuka lagi.
          </>
        ) : (
          <>
            Kamu bisa tarik dana lagi{' '}
            {cooldownEndsAt ? formatHistoryTime(cooldownEndsAt) : 'setelah cooldown-nya kelar'}.{' '}
            {cooldownDays === null
              ? 'Cooldown-nya dihitung dari pengajuan terakhir'
              : `Cooldown-nya ${formatCredits(cooldownDays)} hari dihitung dari pengajuan terakhir`}{' '}
            — tetap jalan walau pengajuannya ditolak.
          </>
        )}
      </p>

      {reason === 'loading' ? null : (
        <ul className="stack-gap-t flex flex-col gap-1.5" aria-label="Syarat penarikan">
          <Requirement
            done={balance >= minimum}
            label="Saldo"
            value={`${formatCredits(Math.min(balance, minimum))}/${formatCredits(minimum)} credit`}
          />
          <Requirement
            done={activeDays >= requiredActiveDays}
            label="Hari aktif"
            value={`${formatCredits(Math.min(activeDays, requiredActiveDays))}/${formatCredits(requiredActiveDays)} hari`}
          />
          <Requirement
            done={activeReferralCount >= requiredActiveReferrals}
            label="Referral aktif"
            value={`${formatCredits(Math.min(activeReferralCount, requiredActiveReferrals))}/${formatCredits(requiredActiveReferrals)} teman`}
          />
          <Requirement
            done={reason !== 'cooldown' && reason !== 'pending'}
            label="Antrean"
            value={
              reason === 'pending'
                ? 'ada yang diproses'
                : reason === 'cooldown'
                  ? 'masih cooldown'
                  : 'kosong'
            }
          />
        </ul>
      )}
    </Surface>
  )
}

function Requirement({
  done,
  label,
  value,
}: {
  done: boolean
  label: string
  value: string
}) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full',
          done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
        )}
      >
        {done ? <GlyphCheck className="size-3" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          done ? 'font-semibold text-success' : 'text-foreground',
        )}
      >
        {value}
      </span>
      <span className="sr-only">{done ? 'sudah terpenuhi' : 'belum terpenuhi'}</span>
    </li>
  )
}
