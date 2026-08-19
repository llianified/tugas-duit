'use client'

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/shared/lib/utils'

type ActionButtonVariant = 'primary' | 'quiet' | 'ghost'

const VARIANT_CLASS: Record<ActionButtonVariant, string> = {
  primary: [
    'control-h w-full bg-primary text-primary-foreground font-semibold',
    'hover:bg-primary-hover',
    'active:bg-primary-active',
    'disabled:bg-muted disabled:text-muted-foreground',
    'disabled:opacity-70 disabled:hover:bg-muted',
  ].join(' '),
  quiet: [
    'control-h w-auto px-3 text-primary font-semibold',
    'hover:text-primary-hover',
    'active:text-primary-active',
    'disabled:text-muted-foreground disabled:opacity-70',
  ].join(' '),
  ghost: [
    'control-h w-full text-muted-foreground font-medium',
    'hover:text-foreground',
    'active:text-foreground',
    'disabled:opacity-40 disabled:hover:text-muted-foreground',
  ].join(' '),
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant
  children: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function ActionButton({
  variant = 'primary',
  className,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'focus-ring transition-ui press-scale-soft group flex items-center justify-center gap-2 rounded-lg text-sm disabled:cursor-not-allowed',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}
