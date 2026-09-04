import type { ArcadePrize } from '@/domain/arcade/arcade'
import { creditsToRupiah } from '@/domain/economy/economy'
import { formatCredits, formatRupiah } from '@/shared/lib/format'

/** Satu-satunya tempat hadiah Arena diterjemahkan jadi teks. Nominal rupiahnya lewat `creditsToRupiah`, tidak pernah dikalikan sendiri di komponen — aturan keras #3 di `CLAUDE.md`. */
export function prizeLabel(prize: ArcadePrize): string {
  if (prize.kind === 'pool') return `Stok +${formatCredits(prize.amount)} credit`
  if (prize.kind === 'energy') return `+${formatCredits(prize.amount)} energi`
  return 'Zonk'
}

/** Baris kedua yang menjelaskan artinya, bukan mengulang labelnya. Stok disebut rupiahnya karena itu yang membuat hadiahnya terasa; energi disebut gunanya karena rupiahnya nol. */
export function prizeDetail(prize: ArcadePrize): string {
  if (prize.kind === 'pool') return `${formatRupiah(creditsToRupiah(prize.amount))} siap dikerjakan`
  if (prize.kind === 'energy') return 'Bisa langsung buat task'
  return 'Nggak dapat apa-apa kali ini'
}

/** Peluang ditulis sebagai persen bulat dari total bobot yang sedang berlaku. Dibulatkan, dan itu disengaja: angka di layar bantuan tidak perlu presisi desimal, yang perlu adalah user bisa membandingkan tiga baris tanpa menghitung. */
export function prizeChancePercent(weight: number, totalWeight: number): number {
  if (totalWeight <= 0) return 0
  return Math.round((weight / totalWeight) * 100)
}
