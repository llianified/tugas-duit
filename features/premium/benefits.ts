import type { PremiumPerks } from '@/domain/premium'
import { formatCredits } from '@/shared/lib/format'

export interface PremiumBenefit {
  key: string
  title: string
  detail: string
}

export function premiumBenefitList(perks: PremiumPerks): PremiumBenefit[] {
  return [
    /**
     * Mahkota memimpin daftar, bukan menutupnya. Ia satu-satunya keuntungan yang dilihat
     * orang lain — sisanya cuma terasa oleh pemiliknya — dan kartu upsell di beranda hanya
     * menampilkan tiga teratas, jadi urutan di sini yang menentukan apakah premium terbaca
     * sebagai status atau sekadar paket kecepatan.
     */
    {
      key: 'badge',
      title: 'Mahkota emas di papan peringkat',
      detail:
        'Kelihatan semua orang yang buka papan peringkat, bukan cuma kamu sendiri. Di header dan panel profil kamu juga muncul.',
    },
    {
      key: 'energy',
      title: `Energi ${formatCredits(perks.maxEnergy)}, ngisi tiap ${formatCredits(perks.energyRegenMinutes)} menit`,
      detail: `Biasanya ${formatCredits(perks.baseMaxEnergy)} energi tiap ${formatCredits(perks.baseEnergyRegenMinutes)} menit. Task bisa digas berturut-turut, nggak nunggu lama.`,
    },
    {
      key: 'pool',
      title: `Stok reward +${formatCredits(perks.poolCapBonus)} credit`,
      detail:
        'Daya tampungnya lebih gede, jadi sekali duduk bisa ngumpulin lebih banyak sebelum stoknya habis.',
    },
    {
      key: 'ads',
      title: 'Bebas iklan',
      detail: 'Nggak ada lagi tayangan iklan buat nambah jatah task. Langsung kerjain aja.',
    },
    {
      key: 'withdraw',
      title: `Cair tiap ${formatCredits(perks.withdrawalCooldownDays)} hari`,
      detail: `User biasa nunggu ${formatCredits(perks.baseWithdrawalCooldownDays)} hari antar penarikan. Punya kamu lebih cepat.`,
    },
    {
      key: 'tasks',
      title: `Batas task harian ${formatCredits(perks.maxTasksPerDay)}`,
      detail: `Naik dari ${formatCredits(perks.baseMaxTasksPerDay)}, jadi nggak kepentok pas lagi rajin-rajinnya.`,
    },
  ]
}
