'use client'

import type { ReactNode } from 'react'
import { hapticSelect } from '@/shared/lib/haptic'
import {
  GlyphCheck,
  GlyphHome,
  GlyphTrophy,
  GlyphUser,
  GlyphUsers,
} from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'
import { ROOT_VIEW, type AppView } from '@/navigation/app-view'

type NavSlot = {
  view: AppView
  label: string
  icon: ReactNode
}

const NAV_SLOTS: readonly NavSlot[] = [
  { view: ROOT_VIEW, label: 'Beranda', icon: <GlyphHome className="glyph-md" /> },
  { view: 'leaderboard', label: 'Peringkat', icon: <GlyphTrophy className="glyph-md" /> },
  { view: 'missions', label: 'Misi', icon: <GlyphCheck className="glyph-md" /> },
  { view: 'referral', label: 'Teman', icon: <GlyphUsers className="glyph-md" /> },
  { view: 'profile', label: 'Profil', icon: <GlyphUser className="glyph-md" /> },
]

export function NavPill({
  activeView,
  onSelect,
}: {
  activeView: AppView
  onSelect: (view: AppView) => void
}) {
  return (
    <nav aria-label="Navigasi utama" className="nav-pill">
      <div className="nav-pill-row">
        {NAV_SLOTS.map((slot) => (
          <NavPillItem key={slot.view} slot={slot} activeView={activeView} onSelect={onSelect} />
        ))}
      </div>
    </nav>
  )
}

/** Sejajar urutan NAV_SLOTS: Beranda, Peringkat, Misi, Teman, Profil. */
const NAV_LABEL_W = ['w-11', 'w-12', 'w-7', 'w-9', 'w-9'] as const

export function NavPillSkeleton() {
  return (
    <div aria-hidden className="nav-pill">
      <div className="nav-pill-row">
        {NAV_SLOTS.map((slot, index) => (
          <div className="nav-pill-item" key={slot.view}>
            <div className="glyph-md animate-pulse rounded-md bg-muted" />
            <div className={cn('h-2.5 animate-pulse rounded-sm bg-muted', NAV_LABEL_W[index])} />
          </div>
        ))}
      </div>
    </div>
  )
}

function NavPillItem({
  slot,
  activeView,
  onSelect,
}: {
  slot: NavSlot
  activeView: AppView
  onSelect: (view: AppView) => void
}) {
  const active = slot.view === activeView

  function handleClick() {
    hapticSelect()
    onSelect(slot.view)
  }

  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={handleClick}
      className={cn('focus-ring transition-ui press-scale nav-pill-item')}
    >
      {slot.icon}
      <span className="nav-pill-label">{slot.label}</span>
    </button>
  )
}
