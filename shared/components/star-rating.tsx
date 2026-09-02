'use client'

import { STAR_MAX } from '@/domain/progression/stars'
import { SHAPE_PATH } from '@/shared/lib/shape-path'
import { cn } from '@/shared/lib/utils'

function GlyphStar({
  filled,
  className,
}: {
  filled: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={SHAPE_PATH.star} />
    </svg>
  )
}

const STAR_STEP_CLASS = ['star-step-0', 'star-step-1', 'star-step-2'] as const

if (STAR_STEP_CLASS.length < STAR_MAX) {
  throw new Error(
    `STAR_STEP_CLASS hanya punya ${STAR_STEP_CLASS.length} langkah untuk STAR_MAX ${STAR_MAX}; tambahkan kelasnya di app/globals.css.`,
  )
}

export function StarRating({
  stars,
  size = 'sm',
  animated = false,
  className,
}: {
  stars: number
  size?: 'sm' | 'lg'
  animated?: boolean
  className?: string
}) {
  const centerIndex = (STAR_MAX - 1) / 2

  return (
    <span
      role="img"
      aria-label={`${stars} dari ${STAR_MAX} bintang`}
      className={cn('inline-flex items-center', size === 'lg' ? 'gap-2' : 'gap-0.5', className)}
    >
      {Array.from({ length: STAR_MAX }, (_, index) => {
        const filled = index < stars
        const iconSize =
          size === 'lg'
            ? index === centerIndex
              ? 'size-12'
              : 'size-10'
            : 'size-3.5'
        return (
          <GlyphStar
            key={index}
            filled={filled}
            className={cn(
              iconSize,
              filled ? 'text-star' : 'text-border',
              animated && `animate-star-in ${STAR_STEP_CLASS[index]}`,
            )}
          />
        )
      })}
    </span>
  )
}

