import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Panel Admin — Tugas Duit',
    template: '%s — Admin Tugas Duit',
  },
  description: 'Pusat kendali operasional Tugas Duit.',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>
}
