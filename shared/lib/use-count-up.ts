'use client'

import { useEffect, useRef, useState } from 'react'

const COUNT_UP_DURATION_MS = 500

function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4
}

export function useCountUp(target: number): number {
  const [display, setDisplay] = useState(target)
  const previousTarget = useRef(target)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const from = previousTarget.current
    previousTarget.current = target

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (target <= from || prefersReducedMotion) {
      setDisplay(target)
      return
    }

    const start = performance.now()

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / COUNT_UP_DURATION_MS)
      setDisplay(Math.round(from + (target - from) * easeOutQuart(progress)))
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [target])

  return display
}
