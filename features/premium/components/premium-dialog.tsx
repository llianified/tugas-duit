'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppDialog, AppDialogBody, AppDialogHeader } from '@/shared/components/dialog'
import type { PremiumMonths, PremiumPlan } from '@/domain/premium'
import { premiumBenefitList } from '@/features/premium/benefits'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphCheck, GlyphCrown, GlyphSpinner } from '@/shared/components/glyph'
import { SectionLabel } from '@/shared/components/section-label'
import { userFacingMessage } from '@/shell/api-client'
import {
  startPremiumCheckout,
  type PremiumInvoice,
  type PremiumState,
} from '@/shell/session-api'
import { formatCredits, formatLongCountdown, formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const POLL_MS = 6_000

export function PremiumDialog({
  open,
  onOpenChange,
  premium,
  onRefresh,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  premium: PremiumState
  onRefresh: () => Promise<unknown>
}) {
  return (
    <AppDialog open={open} onOpenChange={onOpenChange} heightLimit="above-nav">
      <PremiumDialogBody
        premium={premium}
        onRefresh={onRefresh}
        onClose={() => onOpenChange(false)}
      />
    </AppDialog>
  )
}

function PremiumDialogBody({
  premium,
  onRefresh,
  onClose,
}: {
  premium: PremiumState
  onRefresh: () => Promise<unknown>
  onClose: () => void
}) {
  const [invoice, setInvoice] = useState<PremiumInvoice | null>(premium.invoice)
  const [pending, setPending] = useState<PremiumMonths | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activated = premium.active

  const buy = useCallback(
    async (months: PremiumMonths) => {
      setError(null)
      setPending(months)
      try {
        const result = await startPremiumCheckout(months)
        if (result.settled) {
          await onRefresh()
          return
        }
        setInvoice(result.invoice)
      } catch (cause) {
        setError(userFacingMessage(cause))
      } finally {
        setPending(null)
      }
    },
    [onRefresh],
  )

  useEffect(() => {
    if (!invoice || premium.active) return
    const timer = setInterval(() => {
      void onRefresh()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [invoice, onRefresh, premium.active])

  return (
    <>
      <AppDialogHeader
        divided
        icon={<GlyphCrown className="glyph-lg text-premium" />}
        title={activated ? 'Premium aktif' : invoice ? 'Bayar pakai QRIS' : 'Tugas Duit Premium'}
      />

      <AppDialogBody>
        {activated ? (
          <ActivatedPanel premium={premium} onClose={onClose} />
        ) : invoice ? (
          <PaymentPanel
            invoice={invoice}
            onBack={() => setInvoice(null)}
            onRefresh={onRefresh}
          />
        ) : (
          <PlanPanel premium={premium} pending={pending} error={error} onBuy={buy} />
        )}
      </AppDialogBody>
    </>
  )
}

function PlanPanel({
  premium,
  pending,
  error,
  onBuy,
}: {
  premium: PremiumState
  pending: PremiumMonths | null
  error: string | null
  onBuy: (months: PremiumMonths) => void
}) {
  return (
    <>
      <SectionLabel>Yang kamu dapat</SectionLabel>
      <ul className="stack-gap-t space-y-2">
        {premiumBenefitList(premium.perks).map((benefit) => (
          <li key={benefit.key} className="flex items-start gap-2">
            <GlyphCheck className="mt-0.5 size-4 shrink-0 text-premium" />
            <div>
              <p className="text-sm font-semibold leading-snug text-foreground">{benefit.title}</p>
              <p className="text-xs leading-snug text-muted-foreground">{benefit.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <SectionLabel className="region-gap-t block">Pilih paket</SectionLabel>
      <div className="stack-gap-t space-y-2">
        {premium.plans.map((plan) => (
          <PlanRow
            key={plan.months}
            plan={plan}
            busy={pending === plan.months}
            disabled={pending !== null}
            onSelect={() => onBuy(plan.months)}
          />
        ))}
      </div>

      {error ? <p className="stack-gap-t text-xs text-destructive">{error}</p> : null}

      <p className="stack-gap-t text-meta leading-snug text-muted-foreground">
        Pembayaran lewat QRIS, bisa dari e-wallet atau m-banking apa pun. Premium nyala otomatis
        begitu pembayarannya masuk.
      </p>
    </>
  )
}

function PlanRow({
  plan,
  busy,
  disabled,
  onSelect,
}: {
  plan: PremiumPlan
  busy: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'focus-ring transition-ui press-scale-soft relative flex w-full items-center gap-3 rounded-lg p-3 text-left disabled:cursor-not-allowed disabled:opacity-70',
        plan.best
          ? 'bg-premium/10 shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--premium)_55%,transparent)]'
          : 'bg-muted/60 ring-border',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold leading-none text-foreground">
            {formatCredits(plan.months)} bulan
          </p>
          {plan.best ? (
            <span className="rounded-md bg-premium px-2 py-[3px] text-meta font-bold uppercase leading-none tracking-[0.06em] text-card">
              Paling hemat
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-none tabular-nums text-muted-foreground">
          {formatRupiah(plan.pricePerMonthIdr)}/bulan
        </p>
        {plan.savingIdr > 0 ? (
          <p className="mt-1 text-meta leading-none tabular-nums text-premium">
            Hemat {formatRupiah(plan.savingIdr)} ({formatCredits(plan.savingPercent)}%)
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        {plan.savingIdr > 0 ? (
          <p className="text-meta leading-none tabular-nums text-muted-foreground line-through">
            {formatRupiah(plan.baselineIdr)}
          </p>
        ) : null}
        <p className="mt-1 text-base font-semibold leading-none tabular-nums text-foreground">
          {formatRupiah(plan.priceIdr)}
        </p>
      </div>

      {busy ? <GlyphSpinner className="size-4 shrink-0 text-muted-foreground" /> : null}
    </button>
  )
}

function PaymentPanel({
  invoice,
  onBack,
  onRefresh,
}: {
  invoice: PremiumInvoice
  onBack: () => void
  onRefresh: () => Promise<unknown>
}) {
  const secondsLeft = useSecondsLeft(invoice.expiresAt)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      await onRefresh()
    } finally {
      setChecking(false)
    }
  }, [onRefresh])

  return (
    <>
      <p className="text-sm leading-snug text-muted-foreground">
        Scan QR ini dari aplikasi e-wallet atau m-banking kamu untuk paket{' '}
        <span className="font-semibold text-foreground">
          {formatCredits(invoice.months)} bulan
        </span>
        .
      </p>

      {invoice.qrisUrl ? (
        <div className="stack-gap-t flex justify-center rounded-lg bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={invoice.qrisUrl}
            alt={`Kode QRIS untuk pesanan ${invoice.orderId}`}
            className="size-56 max-w-full object-contain"
          />
        </div>
      ) : (
        <p className="stack-gap-t text-sm text-destructive">
          QR-nya gagal dimuat. Tutup dulu, terus coba lagi ya.
        </p>
      )}

      <dl className="stack-gap-t space-y-1.5 rounded-lg bg-muted/60 p-3">
        <Row label="Bayar tepat" value={formatRupiah(invoice.totalAmountIdr)} strong />
        <Row label="Harga paket" value={formatRupiah(invoice.amountIdr)} />
        <Row label="Kode pesanan" value={invoice.orderId} />
        <Row
          label="Berlaku"
          value={secondsLeft > 0 ? formatLongCountdown(secondsLeft) : 'Sudah lewat'}
        />
      </dl>

      <p className="stack-gap-t text-meta leading-snug text-muted-foreground">
        Nominalnya harus <span className="font-semibold text-foreground">persis</span> segitu —
        angka belakangnya kode unik yang dipakai buat mencocokkan pembayaran kamu.
      </p>

      <div className="region-gap-t flex gap-2">
        <ActionButton variant="ghost" className="flex-1" onClick={onBack}>
          Ganti paket
        </ActionButton>
        <ActionButton className="flex-1" onClick={check} disabled={checking}>
          {checking ? 'Mengecek…' : 'Sudah bayar'}
        </ActionButton>
      </div>

      <p className="stack-gap-t text-center text-meta text-muted-foreground">
        Halaman ini ngecek sendiri tiap beberapa detik.
      </p>
    </>
  )
}

function ActivatedPanel({ premium, onClose }: { premium: PremiumState; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <GlyphCrown className="size-10 text-premium" />
      <p className="stack-gap-t text-base font-semibold text-foreground">Premium kamu udah nyala</p>
      <p className="stack-gap-t text-sm leading-snug text-muted-foreground">
        Sisa {formatCredits(premium.daysLeft)} hari. Energi, stok reward, dan jadwal pencairan kamu
        udah pakai aturan premium sekarang.
      </p>
      <ActionButton className="region-gap-t" onClick={onClose}>
        Mulai ngumpulin
      </ActionButton>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'truncate text-right tabular-nums',
          strong ? 'text-base font-semibold text-foreground' : 'text-xs text-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function useSecondsLeft(expiresAt: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, Math.ceil((expiresAt - now) / 1_000))
}
