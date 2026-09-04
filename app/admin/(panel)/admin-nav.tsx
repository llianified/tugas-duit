'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/shared/lib/utils'

const AREAS = [
  { href: '/admin/dashboard', label: 'Ringkasan', shortLabel: 'Pantau', description: 'Kondisi sistem' },
  { href: '/admin/withdrawals', label: 'Payout', shortLabel: 'Payout', description: 'Antrean penarikan' },
  { href: '/admin/users', label: 'Pengguna', shortLabel: 'User', description: 'Akun dan saldo' },
  { href: '/admin/economy', label: 'Ekonomi', shortLabel: 'Ekonomi', description: 'Aturan dan reward' },
  { href: '/admin/ops', label: 'Operasi', shortLabel: 'Operasi', description: 'Siaran dan sistem' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Area panel" className="admin-nav">
      <div className="admin-nav-row">
        {AREAS.map((area) => {
          const active = pathname === area.href || pathname.startsWith(`${area.href}/`)
          return (
            <Link
              key={area.href}
              href={area.href}
              aria-current={active ? 'page' : undefined}
              className={cn('focus-ring transition-ui admin-nav-item', !active && 'hover:text-foreground')}
            >
              <span className="admin-nav-label">
                <span className="admin-nav-label-full">{area.label}</span>
                <span className="admin-nav-label-short">{area.shortLabel}</span>
              </span>
              <span className="admin-nav-description">{area.description}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
