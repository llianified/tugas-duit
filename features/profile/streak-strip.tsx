'use client'

import type { EarningsPoint } from '@/domain/progression/stats'
import { EYEBROW_CLASS } from '@/shared/components/section-label'
import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

const WINDOW_DAYS = 7

/** Tujuh hari WIB terakhir, urut lama ke baru, `true` untuk hari yang ada tasknya.
 *
 * Dibaca dari `earningsSeries`, dan itu sumber yang BENAR untuk pertanyaan ini: deret itu dihitung
 * dari `task_completions` per hari WIB, bukan dari `credit_ledger` — jadi komisi referral,
 * penyesuaian admin, dan tahanan penarikan tidak bisa menyalakan hari yang sebenarnya kosong.
 * Definisinya karena itu sama persis dengan definisi hari aktif yang dipakai streak di server.
 *
 * Deretnya juga sudah memuat hari nol (`generate_series` di `server/task/stats.ts`), jadi tujuh
 * baris terakhir memang tujuh hari terakhir — bukan tujuh hari terakhir yang KEBETULAN ada isinya,
 * yang pada user jarang-jarang bisa membentang berbulan-bulan. */
export function activeDayWindow(series: readonly EarningsPoint[]): boolean[] {
  return series.slice(-WINDOW_DAYS).map((point) => point.credits > 0)
}

/** Streak diangkat keluar dari grid petak dan diberi bentuk.
 *
 * Sebelumnya ia satu petak di antara delapan petak sederajat, jadi "Streak 14 hari" punya bobot
 * visual yang sama dengan "Gabung 15 Agu 2026" — mekanik retensi terkuat aplikasi ini disajikan
 * sebagai trivia. Angka saja juga tidak cukup: 14 tidak menunjukkan apa pun yang bisa PUTUS.
 * Tujuh kotak menunjukkannya, dan kotak terakhir yang masih kosong adalah satu-satunya bentuk di
 * halaman ini yang membuat orang ingin membuka soal hari itu juga.
 *
 * Kotaknya sebaris dengan angkanya, bukan dengan seluruh blok teks, dan alasnya duduk tepat di
 * kaki "14 hari" — terukur nol piksel, bukan dikira-kira. Tiga hal yang membuatnya begitu, dan
 * ketiganya harus ada bersama: barisnya `items-baseline`, wadah kotaknya memakai ukuran huruf yang
 * SAMA dengan angkanya (`text-2xl`) supaya strut kedua item menghasilkan baseline di tempat yang
 * sama, dan kotaknya `inline-block` kosong sehingga tepi bawahnya sendiri yang jadi baseline.
 * Mengubah salah satunya — misalnya menambah `leading-none` pada wadahnya — menggeser strut itu
 * dan kotaknya melayang di atas kaki huruf.
 *
 * Tidak ada baris keterangan di bawahnya. Keadaan "hari ini belum" sudah dinyatakan cincin di
 * kotak terakhir, dan kalimat yang mengulang apa yang sudah terlihat cuma menambah tinggi.
 * Untuk yang tidak melihat bentuknya, kalimat itu tetap ada — di `aria-label` blok ini. */
export function StreakStrip({
  streak,
  series,
}: {
  streak: number
  series: readonly EarningsPoint[]
}) {
  const days = activeDayWindow(series)
  const todayDone = days.at(-1) ?? false
  const label = `Streak ${formatCredits(streak)} hari. ${
    todayDone ? 'Hari ini sudah terkunci.' : 'Hari ini belum ngerjain soal.'
  }`

  return (
    <section aria-label={label} className="stat-tile">
      <p className={EYEBROW_CLASS}>Streak</p>

      <div className="mt-0.5 flex items-baseline justify-between gap-3">
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
          {formatCredits(streak)} hari
        </p>

        {/* `aria-hidden`: kalimat lengkapnya sudah dibawa `aria-label` section ini, dan tujuh kotak
            tanpa nama cuma jadi tujuh pengumuman kosong. */}
        <div aria-hidden="true" className="shrink-0 space-x-1 text-2xl whitespace-nowrap">
          {days.map((active, index) => (
            <span
              key={index}
              className={cn(
                'inline-block size-3.5 rounded-[4px]',
                active ? 'bg-primary' : 'bg-border',
                /* Hari ini diberi cincin, bukan warna lain: warna ketiga menuntut arti ketiga,
                   sementara yang perlu dinyatakan cuma "kotak ini yang masih bisa kamu isi". */
                index === days.length - 1 && !active && 'bg-transparent ring-1 ring-primary/60',
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
