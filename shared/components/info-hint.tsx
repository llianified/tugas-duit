'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { GlyphHelp } from '@/shared/components/glyph'
import { useCssVars } from '@/shared/lib/use-css-vars'
import { cn } from '@/shared/lib/utils'

export function InfoHint({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const bubbleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)

  const [tailLeft, setTailLeft] = useState<number | null>(null)
  const tailRef = useCssVars<HTMLSpanElement>({ '--hint-tail-left': `${tailLeft ?? 0}px` })

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function measure() {
      const bubble = bubbleRef.current
      const trigger = triggerRef.current
      if (!bubble || !trigger) return

      const anchor = bubble.offsetParent as HTMLElement | null
      const target = anchor?.querySelector('[data-hint-tail]') ?? null

      let targetRect: DOMRect | null = null
      if (target) {
        const range = document.createRange()
        range.selectNodeContents(target)
        targetRect = range.getBoundingClientRect()
        if (targetRect.width === 0) targetRect = null
      }

      const anchorRect = targetRect ?? trigger.getBoundingClientRect()
      const bubbleRect = bubble.getBoundingClientRect()
      const center = anchorRect.left + anchorRect.width / 2 - bubbleRect.left

      setTailLeft(Math.min(Math.max(center, 14), Math.max(bubbleRect.width - 14, 14)))
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Apa itu ${label}?`}
        aria-expanded={open}
        aria-controls={open ? bubbleId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'focus-ring transition-ui relative ml-2 inline-flex size-4 shrink-0 items-center justify-center rounded-full',
          'after:absolute after:-inset-2 after:content-[""]',
          open ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          className,
        )}
      >
        <GlyphHelp className="size-4" />
      </button>

      {open ? (
        <span
          ref={bubbleRef}
          id={bubbleId}
          role="note"
          className="animate-hint-in pointer-events-none absolute inset-x-0 top-full z-30 mt-3 block rounded-bubble bg-muted bubble-p text-left text-label font-normal leading-relaxed tracking-normal text-muted-foreground shadow-bubble text-pretty"
        >
          <span
            ref={tailRef}
            aria-hidden="true"
            data-positioned={tailLeft !== null ? 'true' : undefined}
            className="absolute -top-1 left-(--hint-tail-left) hidden size-2.5 -translate-x-1/2 rotate-45 rounded-[3px] bg-muted data-[positioned=true]:block"
          />
          {children}
        </span>
      ) : null}
    </>
  )
}
