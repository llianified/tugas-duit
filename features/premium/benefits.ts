import type { PremiumPerks } from '@/domain/premium'
import { formatCredits } from '@/shared/lib/format'

export interface PremiumBenefit {
  key: string
  title: string
  detail: string
}

export function premiumBenefitList(perks: PremiumPerks): PremiumBenefit[] {
  return [
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
    {
      key: 'badge',
      title: 'Badge emas di profil',
      detail: 'Kelihatan di header dan panel profil kamu.',
    },
  ]
}
