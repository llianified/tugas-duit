'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GlyphBolt, GlyphChart, GlyphUsers, GlyphWallet, GlyphWithdraw } from '@/shared/components/glyph'

const AREAS = [
  { href: '/admin/dashboard', label: 'Pantau', icon: GlyphChart },
  { href: '/admin/withdrawals', label: 'Payout', icon: GlyphWithdraw },
  { href: '/admin/users', label: 'Pengguna', icon: GlyphUsers },
  { href: '/admin/economy', label: 'Ekonomi', icon: GlyphWallet },
  { href: '/admin/ops', label: 'Operasi', icon: GlyphBolt },
] as const

/** Satu-satunya navigasi panel: pill mengapung di bawah, sama seperti Mini App. Tidak ada sidebar dan tidak ada header atas, jadi seluruh tinggi layar ponsel dipakai untuk data. Slot Payout membawa titik merah ketika ada antrean supaya admin tahu ada uang menunggu tanpa membuka halamannya. */
export function AdminNav({ pendingPayouts }: { pendingPayouts: number }) {
  const pathname = usePathname()
  const index = AREAS.findIndex((area) => pathname === area.href || pathname.startsWith(`${area.href}/`))
  const activeIndex = index >= 0 ? index : 0

  return (
    <nav aria-label="Area panel admin" className="admin-nav">
      <div className="admin-nav-row" style={{ '--admin-nav-index': activeIndex } as CSSProperties}>
        <span aria-hidden className="admin-nav-ring">
          <span className="admin-nav-ring-blob" />
        </span>
        {AREAS.map((area, slot) => {
          const active = slot === activeIndex
          const Icon = area.icon
          const alert = area.href === '/admin/withdrawals' && pendingPayouts > 0

          return (
            <Link
              key={area.href}
              href={area.href}
              aria-current={active ? 'page' : undefined}
              className="focus-ring transition-ui admin-nav-item"
            >
              <span className="admin-nav-icon-anchor">
                <Icon className="admin-nav-icon" />
                {alert ? <span aria-hidden className="admin-nav-dot" /> : null}
              </span>
              <span className="admin-nav-text">{area.label}</span>
              {alert ? <span className="sr-only">, {pendingPayouts} payout menunggu</span> : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
