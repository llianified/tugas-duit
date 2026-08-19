'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/shared/lib/utils'

const AREAS = [
  { href: '/admin/dashboard', label: 'Pantau' },
  { href: '/admin/withdrawals', label: 'Payout' },
  { href: '/admin/users', label: 'User' },
  { href: '/admin/economy', label: 'Ekonomi' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Area panel" className="admin-nav">
      <div className="admin-nav-row">
        {AREAS.map((area) => {
          const active = pathname === area.href
          return (
            <Link
              key={area.href}
              href={area.href}
              aria-current={active ? 'page' : undefined}
              className={cn('focus-ring transition-ui admin-nav-item', !active && 'hover:text-foreground')}
            >
              {area.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
