'use client'

import { premiumBenefitList } from '@/features/premium/benefits'
import type { PremiumState } from '@/shell/session-api'
import { GlyphCheck, GlyphChevron, GlyphCrown } from '@/shared/components/glyph'
import { formatCredits, formatRupiah, formatShortDate } from '@/shared/lib/format'

/** Bentuknya perangko — gigi perforasi di keempat tepi, bingkai cetak di dalam, harga di posisi nominal. Alasannya ada di `.stamp` (globals.css): premium dibeli pada nominal tercetak lalu ditempel supaya kelihatan orang lain, dan itu persis cara kerja perangko.

Bentuk itu sekarang milik BERSAMA dengan `ChannelBonusCard`, dan namanya ikut pindah: `.premium-stamp` jadi `.stamp`, yang menyatakan premium tinggal tintanya (`--stamp-accent`, emas sebagai bawaan). Yang berubah di berkas ini hanya nama kelasnya — tata letaknya justru jadi kiblat kartu satunya. */
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

/** Potret perangko: satu-satunya keuntungan premium yang dilihat orang lain. Bidang bundarnya pindah ke `.stamp-portrait` supaya ukuran dan tint-nya satu sumber dengan potret di perangko bonus channel — sebelumnya nilainya nilai arbitrer yang ditulis di sini, jadi mengubah potret satu kartu diam-diam meninggalkan kartu lainnya. */
function CrownPortrait() {
  return (
    <span className="stamp-portrait">
      <GlyphCrown className="stamp-ink-fg size-4" />
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

  /** Tombolnya `flex`, bukan `block`, dan kertasnya `flex-1`. Di dalam carousel tinggi tombol ini diregangkan ke kartu tertinggi; sebagai `block`, kertas di dalamnya tetap setinggi isinya sendiri — `height: 100%` milik `.stamp` tidak punya apa pun untuk diukur, dan kartunya berhenti sebelum tepi slide sambil menyisakan bidang tombol kosong di bawahnya. */
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Lihat paket premium"
      className="focus-ring transition-ui press-scale-soft flex w-full text-left"
    >
      <span className="stamp stamp-card premium-sheen min-w-0 flex-1">
        {/* Nominal perangko: harga di sudut kanan atas, ukuran yang sama dengan angka nominal di perangko bonus — dua kertas, satu tinggi angka. */}
        <span className="stamp-card-head flex items-start justify-between gap-3">
          <span className="home-tag stamp-tag pt-1">Premium</span>
          <span className="flex flex-col items-end gap-1">
            <span className="num-display stamp-ink-fg text-[1.375rem]">
              {formatRupiah(cheapest.pricePerMonthIdr)}
            </span>
            <span className="home-tag">per bulan</span>
          </span>
        </span>

        <span className="stamp-card-lead stack-gap-t flex items-center gap-2">
          <CrownPortrait />
          <span className="text-sm font-semibold leading-snug text-foreground">
            Mahkota emas di samping nama, terlihat di papan peringkat.
          </span>
        </span>

        <span className="stamp-card-detail stack-gap-t flex flex-col gap-1">
          {printed.map((benefit) => (
            <span key={benefit.key} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <GlyphCheck className="stamp-ink-fg mt-0.5 size-3 shrink-0" />
              <span className="leading-snug">{benefit.title}</span>
            </span>
          ))}
        </span>

        {/* Baris aksi kartu ini: ajakan "lihat paket" plus chevron-nya. `.stamp-foot`
            menahannya di garis bawah kertas, jadi ia berhenti setinggi baris tombol
            di perangko bonus channel alih-alih menggantung di tengah slide. */}
        <span className="stamp-card-foot stamp-foot flex items-center justify-between gap-2">
          <span className="text-[11px] leading-snug text-muted-foreground">
            {bestValue
              ? `Ambil ${formatCredits(bestValue.months)} bulan, hemat ${formatCredits(bestValue.savingPercent)}%`
              : 'Lihat semua paket'}
          </span>
          <GlyphChevron className="stamp-ink-fg size-4 shrink-0" direction="right" />
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
    <section aria-label="Status premium" className="stamp">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="home-tag stamp-tag">Premium</p>
          <p className="stack-gap-t flex items-center gap-2 text-sm font-semibold leading-none text-foreground">
            <CrownPortrait />
            Sudah terpasang
          </p>
          {premium.until === null ? null : (
            <p className="stack-gap-t text-xs leading-snug text-muted-foreground">
              Aktif sampai {formatShortDate(premium.until)}. Perpanjangan dihitung dari tanggal ini.
            </p>
          )}
        </div>

        {/* Cap pos: sisa hari, dibaca sebagai "sisa 12 hari". */}
        <p className="stamp-postmark stamp-tag">
          <span className="home-tag stamp-tag">Sisa</span>
          <span className="num-display stamp-ink-fg mt-0.5 text-xl">
            {formatCredits(premium.daysLeft)}
          </span>
          <span className="home-tag stamp-tag mt-0.5">Hari</span>
        </p>
      </div>

      <ul className="stamp-foot flex flex-wrap gap-1.5">
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
