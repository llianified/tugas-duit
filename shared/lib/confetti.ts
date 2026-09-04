'use client'

import type { CreateTypes } from 'canvas-confetti'
import { useCallback, useEffect, useRef } from 'react'

let cannonPromise: Promise<CreateTypes> | null = null

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function createCanvas() {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100'
  document.body.appendChild(canvas)
  return canvas
}

function loadCannon() {
  cannonPromise ??= import('canvas-confetti').then(async ({ default: confetti }) => {
    const cannon = confetti.create(createCanvas(), { resize: true, useWorker: true })
    await cannon({ particleCount: 0 })
    return cannon
  })

  return cannonPromise
}

export function prefetchConfetti() {
  if (cannonPromise || prefersReducedMotion()) return

  const schedule =
    typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback
      : (cb: () => void) => window.setTimeout(cb, 200)

  schedule(() => {
    void loadCannon().catch(() => {
      cannonPromise = null
    })
  })
}

const COLOR_TOKENS = ['--primary', '--success', '--foreground', '--muted-foreground'] as const

function readColors() {
  const styles = getComputedStyle(document.documentElement)
  return COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim()).filter(Boolean)
}

function originOf(element: HTMLElement | null) {
  if (!element) return { x: 0.5, y: 0.42 }
  const rect = element.getBoundingClientRect()
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  }
}

export function useConfettiBurst() {
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    if (!prefersReducedMotion()) prefetchConfetti()
    return () => {
      cancelled.current = true
    }
  }, [])

  return useCallback(async (target?: HTMLElement | null) => {
    if (prefersReducedMotion()) return

    const cannon = await loadCannon()
    if (cancelled.current) return

    const origin = originOf(target ?? null)
    const colors = readColors()

    void cannon({ particleCount: 70, spread: 74, startVelocity: 38, scalar: 0.85, colors, origin })
    for (const dx of [-0.22, 0.22]) {
      void cannon({
        particleCount: 22,
        spread: 55,
        startVelocity: 28,
        scalar: 0.7,
        decay: 0.9,
        colors,
        origin: { x: Math.min(Math.max(origin.x + dx, 0), 1), y: origin.y },
      })
    }
  }, [])
}
