'use client'

import type { Rank } from '@/domain/progression/progression'

interface TierGlyphProps {
  tier: Rank['tier']
  className?: string
}

export function TierGlyph({ tier, className }: TierGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {tier === 1 ? (
        <>
          <path d="m4.6 13.2 7.4-6.4 7.4 6.4" strokeWidth={2} />
          <path d="M8.4 18h7.2" strokeWidth={2} />
        </>
      ) : null}

      {tier === 2 ? (
        <>
          <path d="m12 3.2 8.8 8.8-8.8 8.8L3.2 12Z" />
          <path d="m12 9 3 3-3 3-3-3Z" fill="currentColor" stroke="none" />
        </>
      ) : null}

      {tier === 3 ? (
        <>
          <path d="m12 2.6 9 6.6-3.4 10.6H6.4L3 9.2Z" />
          <path d="m12 8.2 3.6 2.7-1.4 4.3H9.8L8.4 10.9Z" fill="currentColor" stroke="none" />
        </>
      ) : null}

      {tier === 4 ? (
        <>
          <path d="m12 2.4 8.4 4.9v9.4L12 21.6l-8.4-4.9V7.3Z" />
          <path d="m12 6.4 5 2.9v5.8L12 17.8l-5-2.9V9.3Z" />
          <path d="m12 9.4 2.4 1.4v2.8L12 15l-2.4-1.4v-2.8Z" fill="currentColor" stroke="none" />
        </>
      ) : null}

      {tier === 5 ? (
        <>
          <path d="m12 2.2 8.6 5v9.6L12 21.8l-8.6-5V7.2Z" />
          <path d="M12 2.2v3.4M20.6 7.2l-2.9 1.7M20.6 16.8l-2.9-1.7M12 21.8v-3.4M3.4 16.8l2.9-1.7M3.4 7.2l2.9 1.7" />
          <path d="m12 6.6 4.7 2.7v5.4L12 17.4l-4.7-2.7V9.3Z" fill="currentColor" stroke="none" />
        </>
      ) : null}
    </svg>
  )
}
