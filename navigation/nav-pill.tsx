'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { CosmeticKey } from '@/domain/store/cosmetics'
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

/** Nav ikon-only: labelnya pindah ke `sr-only` supaya tombol tetap punya nama yang bisa dibaca pembaca layar. Tanpa itu lima tombol ini cuma terbaca "tombol", dan slot Profil — yang isinya `<img alt="">` — tidak terbaca sama sekali. */
export function NavPill({
  activeView,
  photoUrl,
  frame = null,
  missionsNeedAttention,
  onSelect,
}: {
  activeView: AppView
  photoUrl: string | null
  /** Bingkai yang dipakai user. Slot Profil adalah avatar miliknya sendiri yang paling sering ia
   * lihat, jadi bingkai yang tidak sampai ke sini membuat barang yang sudah dibayar terasa tidak
   * pernah datang. Ukuran slotnya tidak berubah — `ProfileAvatar` menggambar bingkai sebagai
   * padding ke dalam, bukan border. */
  frame?: CosmeticKey | null
  missionsNeedAttention: boolean
  onSelect: (view: AppView) => void
}) {
  const directActiveIndex = NAV_SLOTS.findIndex((slot) => slot.view === activeView)
  /* Statistik dan Riwayat adalah subview Beranda. Menahan ring di slot Beranda membuatnya tetap mounted selama panel terbuka, bukan menghilang lalu muncul mendadak ketika kembali. */
  const activeIndex = directActiveIndex >= 0 ? directActiveIndex : 0
  const visualActiveView = NAV_SLOTS[activeIndex].view

  return (
    <nav aria-label="Navigasi utama" className="nav-pill">
      <div
        className="nav-pill-row"
        style={{ '--nav-active-index': activeIndex } as CSSProperties}
      >
        <span aria-hidden className="nav-pill-indicator">
          <span className="nav-pill-indicator-blob" />
        </span>
        {NAV_SLOTS.map((slot) => (
          <NavPillItem
            key={slot.view}
            slot={slot}
            activeView={visualActiveView}
            photoUrl={photoUrl}
            frame={frame}
            missionsNeedAttention={missionsNeedAttention}
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
  frame,
  missionsNeedAttention,
  onSelect,
}: {
  slot: NavSlot
  activeView: AppView
  photoUrl: string | null
  frame: CosmeticKey | null
  missionsNeedAttention: boolean
  onSelect: (view: AppView) => void
}) {
  const active = slot.view === activeView
  const showStatus = slot.view === 'missions' && missionsNeedAttention

  function handleClick() {
    hapticSelect()
    onSelect(slot.view)
  }

  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={handleClick}
      className={cn('focus-ring nav-pill-item')}
    >
      <span className="nav-pill-slot">
        {slot.icon ? (
          <span className="nav-pill-icon-anchor">
            {slot.icon}
            {showStatus ? <span aria-hidden className="nav-pill-status-dot" /> : null}
          </span>
        ) : (
          <ProfileAvatar
            photoUrl={photoUrl}
            frame={frame}
            className="nav-pill-avatar"
            glyphClassName="size-4"
          />
        )}
      </span>
      <span className="sr-only">
        {slot.label}
        {showStatus ? ', ada misi belum diklaim' : null}
      </span>
    </button>
  )
}
