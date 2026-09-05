'use client'
import { SheetIcon } from '@/shared/components/sheet-icon'

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { PremiumMonths, PremiumPlan } from '@/domain/economy/premium'
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
import { formatCredits, formatLongCountdown, formatRupiah, formatShortDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Jeda polling status pembayaran, terikat plafon `/api/session`: 100 permintaan per jam per user, dan SELURUH aplikasi memakai jatah yang sama. Bentuk sebelumnya memoll tiap 6 detik tanpa henti — 600 permintaan per jam, jadi plafonnya habis dalam sepuluh menit dan yang ikut mati bukan cuma lembar ini melainkan setiap penyegaran saldo, energi, dan stok reward di seluruh app, untuk user yang justru baru saja membayar. Kegagalannya pun diam: SWR menahan data lama sehingga `sessionFailed` tidak pernah menyala. Yang sebenarnya menangkap pembayaran bukan polling rapat melainkan `revalidateOnFocus` pada SWR sesi — user membayar di aplikasi banknya lalu kembali, dan kembalinya itu sudah memicu satu penyegaran. */
const POLL_MS = 15_000

/** Batas keras permintaan yang boleh dipakai satu lembar: 40 × 15 detik = sepuluh menit polling, dan paling banyak 40 dari 100 jatah per jam. Sesudahnya polling berhenti sendiri — statusnya masih tersusul lewat fokus, buka-ulang lembar, atau `startPremiumCheckout` yang menanyakan gateway langsung. */
const POLL_BUDGET = 40

/** Lembar bawah, bukan dialog tengah. Yang dijual di sini dipilih lalu dibayar — dua aksi yang berakhir di jempol — jadi bidangnya naik dari tepi bawah dan tombol bayarnya duduk di kaki lembar yang tidak ikut men-scroll. Lihat `.sheet-popup` di `globals.css` untuk alasan bentuknya.

Alur isinya dibalik dari versi dialog: dulu daftar keuntungan berdiri lebih dulu dan tiap baris paket LANGSUNG membuat tagihan begitu diketuk — jadi satu ketukan pada baris yang cuma ingin dilihat harganya sudah mengunci user ke halaman QRIS, dan paketnya baru bisa diganti lewat tombol "Ganti paket" di layar berikutnya. Sekarang paket dipilih dulu (satu sudah terpilih sejak lembarnya dibuka), harganya dihitung di tempat, dan pembayaran cuma terjadi lewat SATU tombol di kaki lembar. */
export function PremiumSheet({
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

        <Dialog.Popup className="sheet-popup">
          <PremiumSheetBody
            premium={premium}
            onRefresh={onRefresh}
            onClose={() => onOpenChange(false)}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PremiumSheetBody({
  premium,
  onRefresh,
  onClose,
}: {
  premium: PremiumState
  onRefresh: () => Promise<unknown>
  onClose: () => void
}) {
  const [invoice, setInvoice] = useState<PremiumInvoice | null>(premium.invoice)
  const [pending, setPending] = useState(false)
  const showError = useToast()
  const activated = premium.active

  /** Paket termurah bukan yang terpilih di awal, dan itu keputusan yang sama dengan yang sudah dibuat perangko di beranda: kartunya memasang harga per bulan TERMURAH sebagai nominal, dan harga itu milik paket terpanjang. Kalau lembarnya terbuka dengan paket satu bulan terpilih, angka di kaki lembar tidak akan cocok dengan angka yang baru saja diketuk user. `best` juga sudah dilabeli "Paling hemat", jadi bawaan yang lain berarti melabeli satu paket lalu memilih yang lain. */
  const [selected, setSelected] = useState<PremiumMonths>(
    () => (premium.plans.find((plan) => plan.best) ?? premium.plans[0])?.months ?? 1,
  )
  const plan = premium.plans.find((item) => item.months === selected) ?? premium.plans[0] ?? null

  const buy = useCallback(async () => {
    setPending(true)
    try {
      const result = await startPremiumCheckout(selected)
      if (result.settled) {
        await onRefresh()
        return
      }
      setInvoice(result.invoice)
    } catch (cause) {
      showError(userFacingMessage(cause))
    } finally {
      setPending(false)
    }
  }, [onRefresh, selected, showError])

  useEffect(() => {
    if (!invoice || premium.active) return
    let spent = 0
    const timer = setInterval(() => {
      // Tagihan yang sudah lewat umurnya tidak akan berubah jadi lunas lewat polling,
      // dan anggarannya habis berarti berhenti — bukan melambat.
      if (spent >= POLL_BUDGET || Date.now() >= invoice.expiresAt) {
        clearInterval(timer)
        return
      }
      spent += 1
      void onRefresh()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [invoice, onRefresh, premium.active])

  return (
    <>
      <div className="sheet-grip" aria-hidden="true" />

      <div className="flex shrink-0 items-center gap-2 px-content pt-3">
        <SheetIcon tone="premium">
          <GlyphCrown className="premium-glint size-4" />
        </SheetIcon>
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate text-sm font-semibold tracking-tight text-foreground">
            {activated ? 'Premium aktif' : invoice ? 'Bayar pakai QRIS' : 'Tugas Duit Premium'}
          </Dialog.Title>
          <p className="mt-0.5 truncate text-[11px] leading-none text-muted-foreground">
            {activated
              ? `Sisa ${formatCredits(premium.daysLeft)} hari`
              : invoice
                ? `Paket ${formatCredits(invoice.months)} bulan`
                : 'Pilih perangkonya, bayar sekali'}
          </p>
        </div>
        <Dialog.Close
          aria-label="Tutup"
          className="focus-ring transition-ui relative -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
        >
          <GlyphCross className="size-4" />
        </Dialog.Close>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-content pb-3">
        {activated ? (
          <ActivatedPanel premium={premium} />
        ) : invoice ? (
          <PaymentPanel invoice={invoice} />
        ) : plan ? (
          <PlanPanel
            premium={premium}
            plan={plan}
            selected={selected}
            onSelect={setSelected}
          />
        ) : null}
      </div>

      <div className="sheet-foot">
        {activated ? (
          <ActionButton onClick={onClose}>Mulai ngumpulin</ActionButton>
        ) : invoice ? (
          <PaymentFoot
            invoice={invoice}
            onBack={() => setInvoice(null)}
            onRefresh={onRefresh}
          />
        ) : plan ? (
          <>
            <ActionButton onClick={buy} disabled={pending}>
              {pending ? (
                <GlyphSpinner className="size-4" />
              ) : (
                <>
                  Bayar {formatRupiah(plan.priceIdr)}
                  <span className="text-[11px] font-semibold opacity-80">
                    / {formatCredits(plan.months)} bulan
                  </span>
                </>
              )}
            </ActionButton>
            <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
              Bayar pakai QRIS. Premium nyala otomatis begitu pembayarannya masuk.
            </p>
          </>
        ) : null}
      </div>
    </>
  )
}

/** Langkah pertama dan satu-satunya sebelum bayar. Paketnya di atas karena itu yang menentukan angka di kaki lembar; daftar keuntungan turun ke bawahnya karena ia menjawab "kenapa", dan "kenapa" tidak perlu dibaca ulang oleh user yang sudah mengetuk perangko di beranda untuk sampai ke sini. */
function PlanPanel({
  premium,
  plan,
  selected,
  onSelect,
}: {
  premium: PremiumState
  plan: PremiumPlan
  selected: PremiumMonths
  onSelect: (months: PremiumMonths) => void
}) {
  /** Panah kiri/kanan memindahkan pilihan DAN fokusnya, seperti yang dituntut `role="radio"`. Tanpa ini deretannya cuma tiga tombol yang kebetulan berdampingan: pembaca layar mengumumkan "terpilih" dengan benar, tapi keyboard harus menekan Tab tiga kali untuk melewati satu grup yang sebenarnya satu kontrol. */
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0) return
    event.preventDefault()
    const count = premium.plans.length
    const from = premium.plans.findIndex((item) => item.months === selected)
    const to = (from + step + count) % count
    onSelect(premium.plans[to].months)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[to]?.focus()
  }

  return (
    <>
      <SectionLabel as="h3">Pilih paket</SectionLabel>
      <div
        role="radiogroup"
        aria-label="Paket premium"
        onKeyDown={move}
        className="stack-gap-t grid grid-cols-3 items-stretch gap-2"
      >
        {premium.plans.map((item) => (
          <PlanStamp
            key={item.months}
            plan={item}
            checked={item.months === selected}
            onSelect={() => onSelect(item.months)}
          />
        ))}
      </div>

      <dl className="stack-gap-t space-y-1.5 rounded-lg border border-dashed border-border bg-muted/40 p-3">
        <Row label="Total bayar" value={formatRupiah(plan.priceIdr)} strong />
        <Row label="Per bulan" value={`${formatRupiah(plan.pricePerMonthIdr)}/bln`} />
        {plan.savingIdr > 0 ? (
          <>
            <Row label="Harga normal" value={formatRupiah(plan.baselineIdr)} struck />
            <Row
              label={`Hemat ${formatCredits(plan.savingPercent)}%`}
              value={formatRupiah(plan.savingIdr)}
              accent
            />
          </>
        ) : null}
      </dl>

      <SectionLabel as="h3" className="region-gap-t block">
        Yang kamu dapat
      </SectionLabel>
      <ul className="stack-gap-t space-y-2.5">
        {premiumBenefitList(premium.perks).map((benefit) => (
          <li key={benefit.key} className="flex items-start gap-2">
            <GlyphCheck className="mt-0.5 size-4 shrink-0 text-premium" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-foreground text-pretty">
                {benefit.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground text-pretty">
                {benefit.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Satu paket, satu perangko kecil. Bentuknya sengaja bentuk yang sama dengan kartu yang membuka lembar ini: yang diketuk di beranda perangko, jadi yang dipilih di sini perangko juga. Bidang bertintanya yang menyatakan pilihan — lihat `.stamp-chip` di `globals.css` soal kenapa bukan cincin. */
function PlanStamp({
  plan,
  checked,
  onSelect,
}: {
  plan: PremiumPlan
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      onClick={onSelect}
      className="focus-ring transition-ui press-scale-soft flex rounded-md"
    >
      <span className="stamp stamp-chip min-w-0 flex-1" data-selected={checked}>
        <span className="home-tag stamp-tag">
          {plan.savingPercent > 0 ? `Hemat ${formatCredits(plan.savingPercent)}%` : 'Normal'}
        </span>
        <span className="num-display stamp-ink-fg text-[1.75rem]">
          {formatCredits(plan.months)}
        </span>
        <span className="text-[10px] font-medium leading-none text-muted-foreground">bulan</span>
        <span className="text-[11px] font-bold leading-none tabular-nums text-foreground">
          {formatRupiah(plan.priceIdr)}
        </span>
      </span>
    </button>
  )
}

function PaymentPanel({ invoice }: { invoice: PremiumInvoice }) {
  const secondsLeft = useSecondsLeft(invoice.expiresAt)

  return (
    <>
      {/* `.qr-plate`, bukan `bg-card`: pelatnya harus tetap terang di tema gelap supaya QR-nya bisa dipindai. Lihat `--qr-plate` di `globals.css`. */}
      {invoice.qrisUrl ? (
        <div className="qr-plate flex justify-center rounded-lg p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={invoice.qrisUrl}
            alt={`Kode QRIS untuk pesanan ${invoice.orderId}`}
            className="size-52 max-w-full object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-destructive">
          QR-nya gagal muncul. Tutup dulu, terus coba lagi.
        </p>
      )}

      <dl className="stack-gap-t space-y-1.5 rounded-lg border border-dashed border-border bg-muted/40 p-3">
        <Row label="Bayar tepat" value={formatRupiah(invoice.totalAmountIdr)} strong />
        <Row label="Harga paket" value={formatRupiah(invoice.amountIdr)} />
        <Row label="Kode pesanan" value={invoice.orderId} />
        <Row
          label="Berlaku"
          value={secondsLeft > 0 ? formatLongCountdown(secondsLeft) : 'Sudah lewat'}
        />
      </dl>

      <p className="stack-gap-t text-[11px] leading-relaxed text-muted-foreground text-pretty">
        Bayar <span className="font-semibold text-foreground">persis</span> sesuai nominal. Angka
        belakangnya kode unik. Status dicek otomatis.
      </p>
    </>
  )
}

function PaymentFoot({
  invoice,
  onBack,
  onRefresh,
}: {
  invoice: PremiumInvoice
  onBack: () => void
  onRefresh: () => Promise<unknown>
}) {
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
    <div className="flex gap-2">
      <ActionButton variant="ghost" className="flex-1" onClick={onBack}>
        Ganti
      </ActionButton>
      <ActionButton className="flex-1" onClick={check} disabled={checking}>
        {checking ? 'Mengecek…' : 'Sudah bayar'}
      </ActionButton>
      <span className="sr-only">Kode pesanan {invoice.orderId}</span>
    </div>
  )
}

/** Perangko yang sudah tertempel dan dicap. Keadaan ini tidak lagi menampilkan mahkota mengambang dengan paragraf di bawahnya: yang dibeli user benda, jadi yang ditunjukkan setelah dibeli benda itu — kertasnya, dengan sisa hari di dalam cap posnya, persis seperti yang berdiri di beranda. */
function ActivatedPanel({ premium }: { premium: PremiumState }) {
  const benefits = premiumBenefitList(premium.perks)

  return (
    <>
      <section aria-label="Perangko premium kamu" className="stamp">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="home-tag stamp-tag">Premium</p>
            <p className="stack-gap-t flex items-center gap-2 text-sm font-semibold leading-none text-foreground">
              <span className="stamp-portrait">
                <GlyphCrown className="stamp-ink-fg size-4" />
              </span>
              Sudah tertempel
            </p>
            {premium.until === null ? null : (
              <p className="stack-gap-t text-xs leading-relaxed text-muted-foreground text-pretty">
                Aktif sampai {formatShortDate(premium.until)}. Perpanjangan dihitung dari tanggal ini.
              </p>
            )}
          </div>

          <p className="stamp-postmark stamp-tag">
            <span className="home-tag stamp-tag">Sisa</span>
            <span className="num-display stamp-ink-fg mt-0.5 text-xl">
              {formatCredits(premium.daysLeft)}
            </span>
            <span className="home-tag stamp-tag mt-0.5">Hari</span>
          </p>
        </div>
      </section>

      <SectionLabel as="h3" className="region-gap-t block">
        Yang sudah jalan
      </SectionLabel>
      <ul className="stack-gap-t space-y-2">
        {benefits.map((benefit) => (
          <li key={benefit.key} className="flex items-start gap-2">
            <GlyphCheck className="mt-0.5 size-4 shrink-0 text-premium" />
            <p className="text-sm font-semibold leading-snug text-foreground text-pretty">
              {benefit.title}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

function Row({
  label,
  value,
  strong,
  struck,
  accent,
}: {
  label: string
  value: string
  strong?: boolean
  struck?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn('text-xs', accent ? 'font-semibold text-premium' : 'text-muted-foreground')}>
        {label}
      </dt>
      <dd
        className={cn(
          'truncate text-right tabular-nums',
          strong
            ? 'text-base font-bold text-foreground'
            : accent
              ? 'text-xs font-semibold text-premium'
              : 'text-xs text-foreground',
          struck && 'text-muted-foreground line-through',
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
