'use client'

import { TotalSummary } from '@/shared/components/total-summary'

export function AvailableBalance({ balance }: { balance: number }) {
  return (
    <TotalSummary
      label="Saldo tersedia"
      credits={balance}
      hint="TD yang bisa ditarik. Penarikan yang diproses sudah dipotong dari saldo."
    />
  )
}
