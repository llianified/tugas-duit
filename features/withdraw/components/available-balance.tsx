'use client'

import { TotalSummary } from '@/shared/components/total-summary'

export function AvailableBalance({ balance }: { balance: number }) {
  return (
    <TotalSummary
      label="Saldo tersedia"
      credits={balance}
      hint="Credit yang bisa kamu tarik sekarang. Sama dengan saldo di beranda — penarikan yang masih diproses sudah dipotong dari keduanya."
    />
  )
}
