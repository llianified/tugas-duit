'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { PremiumMonths, PremiumPlan } from '@/domain/premium'
import { premiumBenefitList } from '@/features/premium/benefits'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphCheck, GlyphCross, GlyphCrown, GlyphSpinner } from '@/shared/components/glyph'
import { SectionLabel } from '@/shared/components/section-label'
import { userFacingMessage } from '@/shell/api-client'
import {
  startPremiumCheckout,
  type PremiumInvoice,
  type PremiumState,
} from '@/shell/session-api'
import { useToast } from '@/shell/toast'
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-40 bg-scrim duration-150" />

        <Dialog.Popup className="animate-in fade-in zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out data-[ending-style]:zoom-out-95 fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem-2*(var(--nav-pill-h)+var(--content-gap)))] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card outline-none duration-150">
          <PremiumDialogBody
            premium={premium}
            onRefresh={onRefresh}
            onClose={() => onOpenChange(false)}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
  const showError = useToast()
  const activated = premium.active

  const buy = useCallback(
    async (months: PremiumMonths) => {
      setPending(months)
      try {
        const result = await startPremiumCheckout(months)
        if (result.settled) {
          await onRefresh()
          return
        }
        setInvoice(result.invoice)
      } catch (cause) {
        showError(userFacingMessage(cause))
      } finally {
        setPending(null)
      }
    },
    [onRefresh, showError],
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
      <header className="flex items-center gap-2 border-b border-border px-[var(--surface-p)] py-3">
        <GlyphCrown className="size-5 text-premium" />
        <Dialog.Title className="text-sm font-semibold text-foreground">
          {activated ? 'Premium aktif' : invoice ? 'Bayar pakai QRIS' : 'Tugas Duit Premium'}
        </Dialog.Title>
        <Dialog.Close
          aria-label="Tutup"
          className="focus-ring transition-ui ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <GlyphCross className="size-4" />
        </Dialog.Close>
      </header>

      <div className="flex-1 overflow-y-auto px-[var(--surface-p)] py-3">
        {activated ? (
          <ActivatedPanel premium={premium} onClose={onClose} />
        ) : invoice ? (
          <PaymentPanel
            invoice={invoice}
            onBack={() => setInvoice(null)}
            onRefresh={onRefresh}
          />
        ) : (
          <PlanPanel premium={premium} pending={pending} onBuy={buy} />
        )}
      </div>
    </>
  )
}

function PlanPanel({
  premium,
  pending,
  onBuy,
}: {
  premium: PremiumState
  pending: PremiumMonths | null
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

      <p className="stack-gap-t text-[11px] leading-snug text-muted-foreground">
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
            <span className="rounded-md bg-premium px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-card">
              Paling hemat
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-none tabular-nums text-muted-foreground">
          {formatRupiah(plan.pricePerMonthIdr)}/bulan
        </p>
        {plan.savingIdr > 0 ? (
          <p className="mt-1 text-[11px] leading-none tabular-nums text-premium">
            Hemat {formatRupiah(plan.savingIdr)} ({formatCredits(plan.savingPercent)}%)
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        {plan.savingIdr > 0 ? (
          <p className="text-[11px] leading-none tabular-nums text-muted-foreground line-through">
            {formatRupiah(plan.baselineIdr)}
          </p>
        ) : null}
        <p className="mt-1 text-base font-bold leading-none tabular-nums text-foreground">
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

      <p className="stack-gap-t text-[11px] leading-snug text-muted-foreground">
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

      <p className="stack-gap-t text-center text-[11px] text-muted-foreground">
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
          strong ? 'text-base font-bold text-foreground' : 'text-xs text-foreground',
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
