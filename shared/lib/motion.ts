import type { Transition, Variants } from 'motion/react'

export const VIEW_IN_DURATION_MS = 280

export const DURATION = {
  press: 0.12,
  ui: 0.15,
  view: VIEW_IN_DURATION_MS / 1000,
} as const

export const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const

export const SPRING_SOFT: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
  mass: 0.8,
}

export function stepVariants(direction: 1 | -1): Variants {
  const offset = 16 * direction
  return {
    hidden: { opacity: 0, x: offset },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: DURATION.view, ease: EASE_OUT_QUART },
    },
    exit: {
      opacity: 0,
      x: -offset,
      transition: { duration: DURATION.ui, ease: EASE_OUT_QUART },
    },
  }
}
