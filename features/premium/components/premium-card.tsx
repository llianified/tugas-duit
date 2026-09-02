'use client'

import { premiumBenefitList } from '@/features/premium/benefits'
import type { PremiumState } from '@/shell/session-api'
import { GlyphCheck, GlyphChevron, GlyphCrown } from '@/shared/components/glyph'
import { formatCredits, formatRupiah, formatShortDate } from '@/shared/lib/format'

/** Bentuknya perangko — gigi perforasi di keempat tepi, bingkai cetak di dalam, harga di posisi nominal. Alasannya ada di `.premium-stamp` (globals.css): premium dibeli pada nominal tercetak lalu ditempel supaya kelihatan orang lain, dan itu persis cara kerja perangko. */
export function PremiumCard({
  premium,
  onOpen,
}: {
  premium: PremiumState
  onOpen: () => void
}) {
  if (premium.active) return <PremiumActiveStamp premium={premium} />
  if (!premium.paymentEnabled) return null
  return <PremiumUpsellStamp premium={premium} onOpen={onOpen} />
}

/** Potret perangko: satu-satunya keuntungan premium yang dilihat orang lain. */
function CrownPortrait() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--premium)_20%,transparent)]">
      <GlyphCrown className="size-4 text-premium" />
    </span>
  )
}

function PremiumUpsellStamp({
  premium,
  onOpen,
}: {
  premium: PremiumState
  onOpen: () => void
}) {
  const cheapest = premium.plans.reduce((best, plan) =>
    plan.pricePerMonthIdr < best.pricePerMonthIdr ? plan : best,
  )
  const bestValue = premium.plans.find((plan) => plan.best && plan.savingPercent > 0) ?? null

  /** Mahkota dilepas dari daftar, bukan diambil dua kali. `premiumBenefitList` menaruhnya di urutan pertama justru supaya ia jadi kalimat utama di sini — versi sebelumnya memakai tiga teratas apa adanya, jadi baris pertama daftar cuma mengulang kalimat yang persis di atasnya. */
  const [, ...others] = premiumBenefitList(premium.perks)
  const printed = others.slice(0, 2)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Lihat paket premium"
      className="focus-ring transition-ui press-scale-soft block w-full text-left"
    >
      <span className="premium-stamp">
        {/* Nominal perangko: harga di sudut kanan atas, ukuran yang sama dengan angka nominal di kupon bonus — dua kertas, satu tinggi angka. */}
        <span className="flex items-start justify-between gap-3">
          <span className="home-tag premium-stamp-tag pt-1">Premium</span>
          <span className="flex flex-col items-end gap-1">
            <span className="num-display text-[1.375rem] text-premium">
              {formatRupiah(cheapest.pricePerMonthIdr)}
            </span>
            <span className="home-tag">per bulan</span>
          </span>
        </span>

        <span className="stack-gap-t flex items-start gap-2">
          <CrownPortrait />
          <span className="text-sm font-semibold leading-snug text-foreground">
            Mahkota emas di sebelah nama kamu, kelihatan semua orang di papan peringkat.
          </span>
        </span>

        <span className="stack-gap-t block space-y-1">
          {printed.map((benefit) => (
            <span key={benefit.key} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <GlyphCheck className="mt-0.5 size-3 shrink-0 text-premium" />
              <span className="leading-snug">{benefit.title}</span>
            </span>
          ))}
        </span>

        <span className="stack-gap-t flex items-center justify-between gap-2">
          <span className="text-[11px] leading-snug text-muted-foreground">
            {bestValue
              ? `Ambil ${formatCredits(bestValue.months)} bulan, hemat ${formatCredits(bestValue.savingPercent)}%`
              : 'Lihat semua paket'}
          </span>
          <GlyphChevron className="size-4 shrink-0 text-premium" direction="right" />
        </span>
      </span>
    </button>
  )
}

function PremiumActiveStamp({ premium }: { premium: PremiumState }) {
  /** Mahkota dilepas dari chip dengan alasan yang sama seperti di kartu upsell: ia sudah jadi kalimat utama di atas. Sisanya dipotong dua, bukan tiga — judul chip di sini panjang-panjang, jadi tiap chip memakan satu baris penuh di 384px dan yang ketiga membayar setinggi baris untuk perk yang daftar lengkapnya toh ada di dialog. */
  const [, ...others] = premiumBenefitList(premium.perks)
  const benefits = others.slice(0, 2)

  return (
    <section aria-label="Status premium" className="premium-stamp">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="home-tag premium-stamp-tag">Premium</p>
          <p className="stack-gap-t flex items-center gap-2 text-sm font-semibold leading-none text-foreground">
            <CrownPortrait />
            Sudah terpasang
          </p>
          {premium.until === null ? null : (
            <p className="stack-gap-t text-xs leading-snug text-muted-foreground">
              Berlaku sampai {formatShortDate(premium.until)}. Perpanjangan nambah dari tanggal
              ini, bukan dari hari kamu bayar.
            </p>
          )}
        </div>

        {/* Cap pos: sisa hari, dibaca sebagai "sisa 12 hari". */}
        <p className="premium-postmark premium-stamp-tag">
          <span className="home-tag premium-stamp-tag">Sisa</span>
          <span className="num-display mt-0.5 text-xl text-premium">
            {formatCredits(premium.daysLeft)}
          </span>
          <span className="home-tag premium-stamp-tag mt-0.5">Hari</span>
        </p>
      </div>

      <ul className="stack-gap-t flex flex-wrap gap-1.5">
        {benefits.map((benefit) => (
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
