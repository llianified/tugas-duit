import type { PremiumPerks } from '@/domain/economy/premium'
import { formatCredits } from '@/shared/lib/format'

export interface PremiumBenefit {
  key: string
  title: string
  detail: string
}

export function premiumBenefitList(perks: PremiumPerks): PremiumBenefit[] {
  return [
    /** Mahkota memimpin daftar, bukan menutupnya. Ia satu-satunya keuntungan yang dilihat orang lain — sisanya cuma terasa oleh pemiliknya — dan kartu upsell di beranda hanya menampilkan tiga teratas, jadi urutan di sini yang menentukan apakah premium terbaca sebagai status atau sekadar paket kecepatan. */
    {
      key: 'badge',
      title: 'Mahkota emas di papan peringkat',
      detail: 'Mahkota terlihat di papan peringkat, header, dan profil.',
    },
    {
      key: 'energy',
      title: `Energi ${formatCredits(perks.maxEnergy)}, isi tiap ${formatCredits(perks.energyRegenMinutes)} menit`,
      detail: `Biasanya ${formatCredits(perks.baseMaxEnergy)} energi tiap ${formatCredits(perks.baseEnergyRegenMinutes)} menit. Jadi lebih cepat lanjut soal.`,
    },
    {
      key: 'pool',
      title: `Stok reward +${formatCredits(perks.poolCapBonus)} TD`,
      detail: 'Stok lebih besar, jadi kamu bisa kumpulin lebih banyak sebelum habis.',
    },
    /** Judulnya sengaja tidak berbunyi "bebas iklan". Premium hanya mematikan interstitial otomatis; tiket berhadiah tetap hidup karena impresinya yang membayari fitur ini. Menjanjikan nol iklan lalu tetap merender tombol iklan adalah bentuk kebohongan yang paling mahal — user membayar, melihat tombolnya, dan menyimpulkan seluruh daftar ini tidak bisa dipercaya. Kalimat terakhir menutup celah itu di depan, bukan di ulasan. */
    {
      key: 'ads',
      title: 'Iklan otomatis dimatikan',
      detail: 'Iklan otomatis berhenti. Tombol iklan buat nambah jatah soal tetap ada, dan cuma jalan kalau kamu tekan.',
    },
    {
      key: 'withdraw',
      title: `Cair tiap ${formatCredits(perks.withdrawalCooldownDays)} hari`,
      detail: `User biasa menunggu ${formatCredits(perks.baseWithdrawalCooldownDays)} hari. Punya kamu lebih cepat.`,
    },
    {
      key: 'tasks',
      title: `Batas soal harian ${formatCredits(perks.maxTasksPerDay)}`,
      detail: `Naik dari ${formatCredits(perks.baseMaxTasksPerDay)} soal per hari.`,
    },
  ]
}
