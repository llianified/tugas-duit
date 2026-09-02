'use client'

import { useMemo } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { CreditAmount } from '@/shared/components/credit-amount'
import { InfoHint } from '@/shared/components/info-hint'
import type { HistoryEntry } from '@/domain/challenge'
import { creditsToRupiah } from '@/domain/economy'
import {
  HERO_COMPACT_FROM,
  formatCompact,
  formatRupiahCompact,
  isSameWibDay,
} from '@/shared/lib/format'
import { useCountUp } from '@/shared/lib/use-count-up'

export function BalanceSummary({
  balance,
  history,
  onWithdraw,
}: {
  balance: number
  history: HistoryEntry[]
  onWithdraw: () => void
}) {
  const displayedBalance = useCountUp(balance)

  /** "Hari ini" di sini adalah hari WIB, bukan hari perangkat — sama seperti label waktu di riwayat, supaya angka ini tidak pernah berbeda dari daftar yang menjadi sumbernya hanya karena zona ponsel pengguna. */
  const earnedToday = useMemo(
    () =>
      history.reduce((total, entry) => 
        (isSameWibDay(entry.completedAt) ? total + entry.reward : total), 0),
    [history],
  )

  return (
    <section aria-label="Saldo reward">
      {/* Saldo dan aksinya berdiri sebaris, bukan bertumpuk, dan aksinya kini tinggal satu: "Tarik dana". Riwayat pernah berdiri di sini sebagai tombol ikon persegi seukuran CTA — bidang sebesar itu untuk sekadar membuka daftar bacaan membuatnya terbaca sederajat dengan satu-satunya aksi yang memindahkan uang. Pintunya sekarang ada di kepala daftar "Transaksi terakhir", tepat di atas data yang memang dilanjutkannya. */}
      {/* Label "Saldo kamu" pernah berdiri di atas angka ini. Ia dilepas karena tidak ada yang perlu dinamai: nominal terbesar di halaman, dengan satuan "credit" menempel di sampingnya, kurs rupiah di bawahnya, dan "Tarik dana" di sebelahnya sudah mengatakan bahwa ini saldo — dan `aria-label` section ini tetap membawa namanya untuk pembaca layar. Yang tersisa dari label itu cuma satu baris yang mendorong angkanya turun. */}
      <div className="flex items-center gap-3">
        {/* `@container` di sini bukan hiasan: ia yang menjadi acuan `cqi` bagi ukuran angka hero, sehingga nominalnya menyusut mengikuti sisa ruang di samping CTA — bukan mengikuti lebar jendela. */}
        <div className="@container relative min-w-0 flex-1">
          <div className="flex">
            <CreditAmount
              value={formatCompact(displayedBalance, { from: HERO_COMPACT_FROM })}
              size="display"
              tone="neutral"
              hint={
                <InfoHint label="Saldo reward">
                  Credit yang kamu punya sekarang. Penarikan yang masih diproses sudah dipotong dari
                  angka ini, jadi segini persis yang bisa kamu tarik ke e-wallet atau rekening bank
                  begitu jumlahnya cukup.
                </InfoHint>
              }
            />
          </div>
          <p
            data-hint-tail
            className="stack-gap-t text-sm leading-none tabular-nums text-muted-foreground"
          >
            {formatRupiahCompact(creditsToRupiah(displayedBalance), { from: HERO_COMPACT_FROM })}
            <span aria-hidden> · </span>
            {/* Hijau hanya kalau memang ada penambahan nyata hari ini; nol tetap diredam. */}
            <span className={earnedToday > 0 ? 'text-success' : undefined}>
              +{formatCompact(earnedToday, { from: HERO_COMPACT_FROM })} hari ini
            </span>
          </p>
        </div>

        <ActionButton className="w-auto shrink-0 px-5" onClick={onWithdraw}>
          Tarik dana
        </ActionButton>
      </div>
    </section>
  )
}

