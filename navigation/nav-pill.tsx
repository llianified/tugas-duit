'use client'

import type { ReactNode } from 'react'
import { hapticSelect } from '@/shared/lib/haptic'
import { GlyphCheck, GlyphHome, GlyphTrophy, GlyphUsers } from '@/shared/components/glyph'
import { ProfileAvatar } from '@/shared/components/profile-avatar'
import { cn } from '@/shared/lib/utils'
import { ROOT_VIEW, type AppView } from '@/navigation/app-view'

type NavSlot = {
  view: AppView
  label: string
  /** `null` = slot foto: Profil memakai avatar user, bukan glyph. */
  icon: ReactNode | null
}

const NAV_SLOTS: readonly NavSlot[] = [
  { view: ROOT_VIEW, label: 'Beranda', icon: <GlyphHome className="nav-pill-icon" /> },
  { view: 'leaderboard', label: 'Peringkat', icon: <GlyphTrophy className="nav-pill-icon" /> },
  { view: 'missions', label: 'Misi', icon: <GlyphCheck className="nav-pill-icon" /> },
  { view: 'referral', label: 'Teman', icon: <GlyphUsers className="nav-pill-icon" /> },
  { view: 'profile', label: 'Profil', icon: null },
]

/** Nav ikon-only: labelnya pindah ke `sr-only` supaya tombol tetap punya nama yang bisa dibaca pembaca layar. Tanpa itu lima tombol ini cuma terbaca "tombol", dan slot Profil — yang isinya `<img alt="">` — tidak terbaca sama sekali. */
export function NavPill({
  activeView,
  photoUrl,
  onSelect,
}: {
  activeView: AppView
  photoUrl: string | null
  onSelect: (view: AppView) => void
}) {
  return (
    <nav aria-label="Navigasi utama" className="nav-pill">
      <div className="nav-pill-row">
        {NAV_SLOTS.map((slot) => (
          <NavPillItem
            key={slot.view}
            slot={slot}
            activeView={activeView}
            photoUrl={photoUrl}
            onSelect={onSelect}
          />
        ))}
      </div>
    </nav>
  )
}

export function NavPillSkeleton() {
  return (
    <div aria-hidden className="nav-pill">
      <div className="nav-pill-row">
        {NAV_SLOTS.map((slot) => (
          <div className="nav-pill-item" key={slot.view}>
            <div className="nav-pill-slot">
              <div className="nav-pill-icon animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NavPillItem({
  slot,
  activeView,
  photoUrl,
  onSelect,
}: {
  slot: NavSlot
  activeView: AppView
  photoUrl: string | null
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
      <span className="nav-pill-slot transition-ui">
        {slot.icon ?? (
          <ProfileAvatar
            photoUrl={photoUrl}
            className="nav-pill-avatar transition-ui"
            glyphClassName="size-4"
          />
        )}
      </span>
      <span className="sr-only">{slot.label}</span>
    </button>
  )
}
