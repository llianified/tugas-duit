import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payout — Tugas Duit',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>
}
