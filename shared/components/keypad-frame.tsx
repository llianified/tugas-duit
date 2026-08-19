'use client'

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { hapticTap } from '@/shell/haptic'
import { cn } from '@/shared/lib/utils'

export const KEYPAD_KEY_CLASS =
  'focus-ring transition-ui flex items-center justify-center rounded-lg bg-muted font-medium text-foreground hover:bg-muted-foreground/15 active:bg-primary/15 active:text-primary disabled:opacity-40'

export const KEYPAD_HEIGHT_CLASS = 'h-[14.5rem] min-h-[12rem]'

export function KeypadFrame({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('panel-t flex shrink flex-col pb-3', className)} />
}

interface KeypadKeyProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> {
  children: ReactNode
  onPress: () => void
}

export function KeypadKey({ children, className, onPress, disabled, ...props }: KeypadKeyProps) {
  function handleClick() {
    hapticTap()
    onPress()
  }

  return (
    <button
      type="button"
      {...props}
      disabled={disabled}
      onClick={handleClick}
      className={cn(KEYPAD_KEY_CLASS, 'press-scale', className)}
    >
      {children}
    </button>
  )
}
