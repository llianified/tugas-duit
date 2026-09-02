'use client'

import type { ShapeKey } from '@/domain/challenge'
import { SHAPE_PATH } from '@/shared/lib/shape-path'

export function GlyphShape({
  shape,
  className,
}: {
  shape: ShapeKey
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={SHAPE_PATH[shape]} />
    </svg>
  )
}

