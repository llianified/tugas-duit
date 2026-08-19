'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'

export function useCssVars<T extends HTMLElement = HTMLElement>(
  vars: Record<string, string | number>,
): RefObject<T | null> {
  const ref = useRef<T>(null)

  const serialized = JSON.stringify(vars)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const entries = JSON.parse(serialized) as Record<string, string | number>
    for (const [name, value] of Object.entries(entries)) {
      element.style.setProperty(name, String(value))
    }
  }, [serialized])

  return ref
}
