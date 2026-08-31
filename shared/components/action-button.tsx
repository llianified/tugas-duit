'use client'

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/shared/lib/utils'

type ActionButtonVariant = 'primary' | 'soft' | 'quiet' | 'ghost' | 'danger'
type ActionButtonSize = 'md' | 'compact' | 'micro'

const VARIANT_CLASS: Record<ActionButtonVariant, string> = {
  primary: [
    'w-full bg-primary text-primary-foreground font-bold',
    'hover:bg-primary-hover',
    'active:bg-primary-active',
    'disabled:bg-muted disabled:text-muted-foreground',
    'disabled:opacity-70 disabled:hover:bg-muted',
  ].join(' '),
  soft: [
    'w-full btn-soft text-foreground font-bold',
    'hover:bg-muted',
    'disabled:text-muted-foreground disabled:opacity-70',
  ].join(' '),
  quiet: [
    'w-auto px-3 text-primary font-bold',
    'hover:text-primary-hover',
    'active:text-primary-active',
    'disabled:text-muted-foreground disabled:opacity-70',
  ].join(' '),
  ghost: [
    'w-full text-muted-foreground font-semibold',
    'hover:text-foreground',
    'active:text-foreground',
    'disabled:opacity-40 disabled:hover:text-muted-foreground',
  ].join(' '),
  danger: [
    'w-full bg-destructive text-primary-foreground font-bold',
    'hover:opacity-90',
    'active:opacity-80',
    'disabled:bg-muted disabled:text-muted-foreground',
    'disabled:opacity-70 disabled:hover:bg-muted',
  ].join(' '),
}

const SIZE_CLASS: Record<ActionButtonSize, string> = {
  md: 'control-h text-cta',
  compact: 'control-h-compact px-3 text-label',
  micro: 'control-h-micro px-2.5 text-meta',
}

export function actionButtonClass({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ActionButtonVariant
  size?: ActionButtonSize
  className?: string
} = {}) {
  return cn(
    'focus-ring transition-ui press-scale-soft group flex items-center justify-center gap-2 rounded-cta tracking-tight disabled:cursor-not-allowed',
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    className,
  )
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant
  size?: ActionButtonSize
  children: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function ActionButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={actionButtonClass({ variant, size, className })}
    >
      {children}
    </button>
  )
}
