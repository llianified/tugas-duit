'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useCssVars } from '@/shared/lib/use-css-vars'

export function useIslandGeometry() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [pillBox, setPillBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const [rowCenter, setRowCenter] = useState<number | null>(null)
  const islandRef = useCssVars<HTMLDivElement>({
    ...(contentHeight === null ? {} : { '--panel-h': `${contentHeight}px` }),
    ...(pillBox
      ? {
          '--island-pill-top': `${pillBox.top}px`,
          '--island-pill-left': `${pillBox.left}px`,
          '--island-pill-w': `${pillBox.width}px`,
        }
      : {}),
    ...(rowCenter === null ? {} : { '--island-row-center': `${rowCenter}px` }),
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
      // Titik tengah barisnya, bukan titik tengah viewport: frame app dibatasi `max-w-md` dan
      // dipusatkan, jadi di layar lebar 50vw bukan tengah pita. Pill yang "naik ke tengah" saat
      // island lain terbuka butuh angka ini supaya berhenti tepat di tengah pita.
      const rowRect = pillBoxSource!.parentElement?.getBoundingClientRect()
      if (rowRect) {
        const center = rowRect.left + rowRect.width / 2
        setRowCenter((previous) => (previous === center ? previous : center))
      }
    }

    measurePill()
    const observer = new ResizeObserver(measurePill)
    observer.observe(pillBoxSource)
    // The pill also moves sideways when a sibling in the brand band row is | added, removed, or slides aside. Those reflows never change the pill's | own box, so observe the row as well to avoid animating from a stale | anchor.
    const row = pillBoxSource.parentElement
    if (row) observer.observe(row)
    row?.addEventListener('transitionend', measurePill)
    window.addEventListener('resize', measurePill)
    return () => {
      observer.disconnect()
      row?.removeEventListener('transitionend', measurePill)
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
      const target = event.target
      if (!(target instanceof Node)) return
      if (islandRef.current?.contains(target)) return
      // Tekanan yang mendarat di pill island lain tidak ditutup di sini, karena menutup panel
      // sekarang akan mengubah tata letak pita di tengah gestur: pill yang sedang dipromosikan
      // langsung menyusut balik ke lingkaran, jadi pointerup mendarat di elemen lain dan
      // browser menaikkan `click`-nya ke pita — panelnya tertutup tanpa ada yang terbuka.
      // Toggle pill itu sendiri yang menentukan panel berikutnya, dan itu sudah menggantikan
      // panel yang terbuka.
      if (target instanceof Element && target.closest('.island-pill')) return
      onClose()
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
