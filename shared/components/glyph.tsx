'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

function GlyphSvg({
  children,
  className,
  strokeWidth = 2,
}: {
  children: ReactNode
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  )
}

const CHEVRON_TRANSFORM = {
  right: '',
  left: '-scale-x-100',
  down: 'rotate-90',
  up: '-rotate-90',
} as const

export function GlyphChevron({
  direction = 'right',
  className,
}: {
  direction?: keyof typeof CHEVRON_TRANSFORM
  className?: string
}) {
  return (
    <GlyphSvg className={cn(className, CHEVRON_TRANSFORM[direction])}>
      <path d="M9 6l6 6l-6 6" />
    </GlyphSvg>
  )
}

export function GlyphWithdraw({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
      <path d="M7 11l5 5l5 -5" />
      <path d="M12 4l0 12" />
    </GlyphSvg>
  )
}

export function GlyphCheck({
  className,
  animated = false,
}: {
  className?: string
  animated?: boolean
}) {
  return (
    <GlyphSvg className={className}>
      <path
        d="M5 12l5 5l10 -10"
        pathLength={22}
        className={animated ? 'animate-check-draw' : undefined}
      />
    </GlyphSvg>
  )
}

export function GlyphCross({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </GlyphSvg>
  )
}

export function GlyphBackspace({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M20 6a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-11l-5 -5a1.5 1.5 0 0 1 0 -2l5 -5l11 0" />
      <path d="M12 10l4 4m0 -4l-4 4" />
    </GlyphSvg>
  )
}

export function GlyphCopy({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" />
      <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
    </GlyphSvg>
  )
}

export function GlyphShare({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M8.7 10.7l6.6 -3.4" />
      <path d="M8.7 13.3l6.6 3.4" />
    </GlyphSvg>
  )
}

export function GlyphHome({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M5 12l-2 0l9 -9l9 9l-2 0" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
      <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />
    </GlyphSvg>
  )
}

export function GlyphHistory({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 8l0 4l2 2" />
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
    </GlyphSvg>
  )
}

export function GlyphUser({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
    </GlyphSvg>
  )
}

export function GlyphUsers({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />
    </GlyphSvg>
  )
}

export function GlyphChart({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6" />
      <path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10" />
      <path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14" />
      <path d="M4 20h14" />
    </GlyphSvg>
  )
}

export function GlyphTrophy({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M8 21l8 0" />
      <path d="M12 17l0 4" />
      <path d="M7 4l10 0" />
      <path d="M17 4v8a5 5 0 0 1 -10 0v-8" />
      <path d="M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    </GlyphSvg>
  )
}

export function GlyphWallet({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" />
      <path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" />
    </GlyphSvg>
  )
}

export function GlyphBolt({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />
    </GlyphSvg>
  )
}

export function GlyphCrown({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4z" />
    </GlyphSvg>
  )
}

export function GlyphTelegram({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4" />
    </GlyphSvg>
  )
}

export function GlyphPlay({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M7 4v16l13 -8z" />
    </GlyphSvg>
  )
}

export function GlyphHelp({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 16v.01" />
      <path d="M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483" />
    </GlyphSvg>
  )
}

export function GlyphSun({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />
    </GlyphSvg>
  )
}

export function GlyphMoon({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" />
    </GlyphSvg>
  )
}

export function GlyphSpinner({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M12 3a9 9 0 1 0 9 9" />
    </GlyphSvg>
  )
}
