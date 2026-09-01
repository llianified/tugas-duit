'use client'

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/shared/lib/utils'

type ActionButtonVariant = 'primary' | 'quiet' | 'ghost'

/*
 * Varian berpelat (primary, ghost) memakai `.plate-3d` / `.plate-3d-soft`:
 * keduanya sudah menganimasikan `transform` sendiri (tekan-turun), jadi
 * `press-scale-soft` sengaja tidak dipakai di sana agar transform tidak bentrok.
 */
const VARIANT_CLASS: Record<ActionButtonVariant, string> = {
  primary: [
    'plate-3d w-full bg-primary text-primary-foreground font-extrabold',
    'hover:bg-primary-hover',
    'active:bg-primary-active',
    'disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
    'disabled:opacity-70 disabled:hover:bg-muted',
  ].join(' '),
  quiet: [
    'press-scale-soft w-auto px-3 text-primary font-bold',
    'hover:text-primary-hover',
    'active:text-primary-active',
    'disabled:text-muted-foreground disabled:opacity-70',
  ].join(' '),
  ghost: [
    'plate-3d-soft w-full text-foreground font-bold',
    'hover:bg-muted',
    'disabled:text-muted-foreground disabled:opacity-60 disabled:shadow-none disabled:hover:bg-card',
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
        'focus-ring transition-ui group flex items-center justify-center gap-2 rounded-cta text-[17px] tracking-tight disabled:cursor-not-allowed',
        'control-h',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}
