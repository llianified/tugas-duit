'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useCssVars } from '@/shared/lib/use-css-vars'

export function useIslandGeometry() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [pillBox, setPillBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const islandRef = useCssVars<HTMLDivElement>({
    ...(contentHeight === null ? {} : { '--panel-h': `${contentHeight}px` }),
    ...(pillBox
      ? {
          '--island-pill-top': `${pillBox.top}px`,
          '--island-pill-left': `${pillBox.left}px`,
          '--island-pill-w': `${pillBox.width}px`,
        }
      : {}),
  })

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const observer = new ResizeObserver(() => {
      setContentHeight(content.scrollHeight)
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const pillBoxSource = islandRef.current
    if (!pillBoxSource) return

    function measurePill() {
      const rect = pillBoxSource!.getBoundingClientRect()
      setPillBox((previous) =>
        previous &&
        previous.top === rect.top &&
        previous.left === rect.left &&
        previous.width === rect.width
          ? previous
          : { top: rect.top, left: rect.left, width: rect.width },
      )
    }

    measurePill()
    const observer = new ResizeObserver(measurePill)
    observer.observe(pillBoxSource)
    window.addEventListener('resize', measurePill)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measurePill)
    }
  }, [islandRef])

  return { islandRef, contentRef }
}

export function useIslandDismiss({
  isOpen,
  islandRef,
  onClose,
}: {
  isOpen: boolean
  islandRef: RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  useEffect(() => {
    if (!isOpen) return

    function closeOnOutsidePress(event: PointerEvent) {
      if (!islandRef.current?.contains(event.target as Node)) onClose()
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen, islandRef, onClose])
}
