'use client'

import { premiumBenefitList } from '@/features/premium/benefits'
import type { PremiumState } from '@/shell/session-api'
import { GlyphCheck, GlyphChevron, GlyphCrown } from '@/shared/components/glyph'
import { SectionLabel } from '@/shared/components/section-label'
import { formatCredits, formatRupiah, formatShortDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export function PremiumCard({
  premium,
  onOpen,
}: {
  premium: PremiumState
  onOpen: () => void
}) {
  if (premium.active) return <PremiumActiveCard premium={premium} />
  if (!premium.paymentEnabled) return null
  return <PremiumUpsellCard premium={premium} onOpen={onOpen} />
}

const GOLD_SURFACE =
  'rounded-lg bg-gradient-to-br from-[color-mix(in_oklab,var(--premium)_18%,transparent)] to-transparent shadow-[0_0_0_1px_color-mix(in_oklab,var(--premium)_35%,transparent)]'

function PremiumActiveCard({ premium }: { premium: PremiumState }) {
  return (
    <section aria-label="Status premium" className={cn(GOLD_SURFACE, 'p-[var(--surface-p)]')}>
      <div className="flex items-center gap-2">
        <GlyphCrown className="size-5 text-premium" />
        <p className="text-sm font-semibold leading-none text-foreground">Premium aktif</p>
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-premium">
          {formatCredits(premium.daysLeft)} hari lagi
        </span>
      </div>

      {premium.until === null ? null : (
        <p className="stack-gap-t text-xs leading-snug text-muted-foreground">
          Berlaku sampai {formatShortDate(premium.until)}. Perpanjangan nambah dari tanggal ini,
          bukan dari hari kamu bayar.
        </p>
      )}

      <ul className="stack-gap-t flex flex-wrap gap-1.5">
        {premiumBenefitList(premium.perks)
          .slice(0, 4)
          .map((benefit) => (
            <li
              key={benefit.key}
              className="inline-flex items-center gap-1 rounded-md bg-premium/10 px-1.5 py-1 text-[11px] font-medium text-premium"
            >
              <GlyphCheck className="size-3" />
              {benefit.title}
            </li>
          ))}
      </ul>
    </section>
  )
}

function PremiumUpsellCard({
  premium,
  onOpen,
}: {
  premium: PremiumState
  onOpen: () => void
}) {
  const cheapest = premium.plans.reduce((best, plan) =>
    plan.pricePerMonthIdr < best.pricePerMonthIdr ? plan : best,
  )
  const benefits = premiumBenefitList(premium.perks).slice(0, 3)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Lihat paket premium"
      className={cn(
        GOLD_SURFACE,
        'focus-ring transition-ui press-scale-soft w-full p-[var(--surface-p)] text-left',
      )}
    >
      <div className="flex items-center gap-2">
        <GlyphCrown className="size-5 text-premium" />
        <SectionLabel className="text-premium">Premium</SectionLabel>
        <GlyphChevron className="ml-auto size-4 text-muted-foreground" direction="right" />
      </div>

      <p className="stack-gap-t text-sm font-semibold leading-snug text-foreground">
        Ngumpulin lebih cepat, cairin lebih sering.
      </p>

      <ul className="stack-gap-t space-y-1">
        {benefits.map((benefit) => (
          <li key={benefit.key} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <GlyphCheck className="mt-0.5 size-3 shrink-0 text-premium" />
            <span className="leading-snug">{benefit.title}</span>
          </li>
        ))}
      </ul>

      <p className="stack-gap-t text-xs leading-none tabular-nums text-muted-foreground">
        Mulai <span className="font-semibold text-foreground">{formatRupiah(cheapest.pricePerMonthIdr)}</span>
        /bulan
      </p>
    </button>
  )
}
