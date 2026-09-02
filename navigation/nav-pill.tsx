'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { hapticSelect } from '@/shared/lib/haptic'
import { GlyphBolt, GlyphHome, GlyphTrophy, GlyphUsers } from '@/shared/components/glyph'
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
  { view: 'missions', label: 'Misi', icon: <GlyphBolt className="nav-pill-icon" /> },
  { view: 'referral', label: 'Teman', icon: <GlyphUsers className="nav-pill-icon" /> },
  { view: 'profile', label: 'Profil', icon: null },
]

/** Harus sama dengan `--nav-morph-ms` di globals.css: penanda morph dilepas tepat saat animasi gooey-nya habis. */
const NAV_MORPH_MS = 320

type NavMorph = {
  /** Slot asal dan tujuan; jaraknya menentukan seberapa jauh bidang aktif melar. */
  from: number
  to: number
  /** Naik tiap perpindahan supaya `key` berubah dan animasi CSS-nya mulai dari nol lagi. */
  token: number
}

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
  const activeIndex = NAV_SLOTS.findIndex((slot) => slot.view === activeView)
  const [morph, setMorph] = useState<NavMorph | null>(null)
  const previousIndexRef = useRef(activeIndex)
  const tokenRef = useRef(0)

  /* Transisi hyperisland butuh tahu dari slot mana bidang aktif datang — CSS sendiri cuma tahu posisi tujuan, jadi jarak tempuhnya dihitung di sini lalu dikirim sebagai variabel. */
  useEffect(() => {
    const previousIndex = previousIndexRef.current
    previousIndexRef.current = activeIndex
    /* Indeks negatif berarti tidak ada slot nav yang aktif (indikatornya disembunyikan), jadi tidak ada yang perlu dilelehkan. */
    if (previousIndex === activeIndex || previousIndex < 0 || activeIndex < 0) return

    tokenRef.current += 1
    setMorph({ from: previousIndex, to: activeIndex, token: tokenRef.current })
    const timer = window.setTimeout(() => setMorph(null), NAV_MORPH_MS)
    return () => window.clearTimeout(timer)
  }, [activeIndex])

  return (
    <nav aria-label="Navigasi utama" className="nav-pill">
      <div
        className="nav-pill-row"
        data-has-active={activeIndex >= 0}
        data-nav-morph={morph ? 'true' : undefined}
        style={
          {
            '--nav-active-index': activeIndex,
            '--nav-travel': morph ? Math.abs(morph.to - morph.from) : 0,
          } as CSSProperties
        }
      >
        <span aria-hidden className="nav-pill-indicator">
          {/* `key` sengaja ikut token: elemen baru = animasi gooey-nya jalan ulang walau arah pindahnya sama. */}
          <span
            key={morph ? morph.token : 'idle'}
            className="nav-pill-indicator-blob"
            data-nav-morph={morph ? 'true' : undefined}
          />
        </span>
        {NAV_SLOTS.map((slot, index) => (
          <NavPillItem
            key={slot.view}
            slot={slot}
            activeView={activeView}
            photoUrl={photoUrl}
            onSelect={onSelect}
            morphing={morph ? index === morph.from || index === morph.to : false}
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
  morphing,
}: {
  slot: NavSlot
  activeView: AppView
  photoUrl: string | null
  onSelect: (view: AppView) => void
  /** Hanya slot asal dan tujuan yang ikut blur, supaya cuma dua lapis filter yang aktif saat berpindah. */
  morphing: boolean
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
      data-nav-morph={morphing ? 'true' : undefined}
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
