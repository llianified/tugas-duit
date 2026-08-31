'use client'

import { Dialog } from '@base-ui/react/dialog'
import type { ReactNode } from 'react'
import { GlyphCross } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

const BACKDROP_CLASS =
  'animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-40 bg-scrim duration-150'

const POPUP_CLASS =
  'animate-in fade-in zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out data-[ending-style]:zoom-out-95 fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-card outline-none duration-150'

const HEIGHT_CLASS = {
  screen: 'max-h-[calc(100dvh-2rem)]',
  'above-nav': 'max-h-[calc(100dvh-2rem-2*(var(--nav-pill-h)+var(--content-gap)))]',
} as const

export function AppDialogHeader({
  title,
  icon,
  divided = false,
}: {
  title: ReactNode
  icon?: ReactNode
  divided?: boolean
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 px-content',
        divided ? 'border-b border-border pb-3 pt-[var(--header-gap)]' : 'pt-[var(--header-gap)]',
      )}
    >
      <Dialog.Title className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
        {icon}
        <span className="truncate">{title}</span>
      </Dialog.Title>
      <Dialog.Close
        aria-label="Tutup"
        className="focus-ring transition-ui relative -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
      >
        <GlyphCross className="size-4" />
      </Dialog.Close>
    </div>
  )
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  titleIcon,
  heightLimit = 'screen',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  titleIcon?: ReactNode
  heightLimit?: keyof typeof HEIGHT_CLASS
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP_CLASS} />
        <Dialog.Popup className={cn(POPUP_CLASS, HEIGHT_CLASS[heightLimit])}>
          {title === undefined ? null : <AppDialogHeader title={title} icon={titleIcon} />}
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function AppDialogBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-content pb-[var(--content-px)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
