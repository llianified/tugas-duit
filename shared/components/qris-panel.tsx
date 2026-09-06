'use client'

import { useEffect, useState } from 'react'
import { formatLongCountdown, formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Layar QRIS, satu bentuk untuk semua yang dibayar tunai.
 *
 * Dulu ia tinggal di dalam lembar premium sebagai komponen lokal. Waktu Toko TD ikut menerima QRIS,
 * menyalinnya berarti dua layar pembayaran yang boleh menyimpang — dan yang paling mungkin
 * menyimpang justru kalimat "bayar persis sesuai nominal", satu-satunya instruksi di sini yang
 * kalau tidak dibaca membuat pembayaran user tidak pernah tercocokkan. Satu bentuk, satu kalimat.
 *
 * Yang membedakan dua pemakainya cuma `priceLabel`: premium menyebut harga paketnya, toko menyebut
 * harga barangnya. */
export function QrisPanel({
  qrisUrl,
  orderId,
  amountIdr,
  totalAmountIdr,
  expiresAt,
  priceLabel,
}: {
  qrisUrl: string | null
  orderId: string
  amountIdr: number
  totalAmountIdr: number
  expiresAt: number
  priceLabel: string
}) {
  const secondsLeft = useSecondsLeft(expiresAt)

  return (
    <>
      {/* `.qr-plate`, bukan `bg-card`: pelatnya harus tetap terang di tema gelap supaya QR-nya bisa dipindai. Lihat `--qr-plate` di `globals.css`. */}
      {qrisUrl ? (
        <div className="qr-plate flex justify-center rounded-lg p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrisUrl}
            alt={`Kode QRIS untuk pesanan ${orderId}`}
            className="size-52 max-w-full object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-destructive">
          QR-nya gagal muncul. Tutup dulu, terus coba lagi.
        </p>
      )}

      <dl className="stack-gap-t space-y-1.5 rounded-lg border border-dashed border-border bg-muted/40 p-3">
        <DetailRow label="Bayar tepat" value={formatRupiah(totalAmountIdr)} strong />
        <DetailRow label={priceLabel} value={formatRupiah(amountIdr)} />
        <DetailRow label="Kode pesanan" value={orderId} />
        <DetailRow
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

/** Baris label/nilai di dalam petak bergaris putus-putus. Diekspor karena panel paket premium
 * memakai bentuk yang sama untuk daftar harganya, dan dua baris yang terlihat sama tapi ditulis
 * dua kali akan berhenti terlihat sama pada perubahan berikutnya. */
export function DetailRow({
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

export function useSecondsLeft(expiresAt: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, Math.ceil((expiresAt - now) / 1_000))
}
