'use client'

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/shared/lib/utils'

type ActionButtonVariant = 'primary' | 'quiet' | 'ghost'
/**
 * Ukuran KOTAK, bukan ukuran label.
 *
 * Labelnya selalu `--btn-label` (15px, kiblatnya "Mulai" di karcis beranda).
 * Tombol yang berada di bawah aksi utama menyusut tingginya lewat `sm`, dan itu
 * satu-satunya cara menurunkan derajatnya — mengecilkan hurufnya cuma membuat
 * tombolnya lebih sulit dibaca tanpa membuatnya terbaca lebih rendah.
 */
type ActionButtonSize = 'md' | 'sm'

const SIZE_CLASS: Record<ActionButtonSize, string> = {
  md: 'control-h',
  sm: 'control-h-sm',
}

const VARIANT_CLASS: Record<ActionButtonVariant, string> = {
  primary: [
    'btn-glass w-full bg-primary text-primary-foreground font-extrabold',
    'hover:bg-primary-hover',
    'active:bg-primary-active',
    'disabled:bg-muted disabled:text-muted-foreground',
    'disabled:opacity-70 disabled:hover:bg-muted disabled:shadow-none',
  ].join(' '),
  quiet: [
    'press-scale-soft w-auto px-3 text-primary font-bold',
    'hover:text-primary-hover',
    'active:text-primary-active',
    'disabled:text-muted-foreground disabled:opacity-70',
  ].join(' '),
  ghost: [
    'btn-glass-quiet w-full text-foreground font-bold',
    'disabled:text-muted-foreground disabled:opacity-50 disabled:shadow-none',
  ].join(' '),
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
      className={cn(
        'focus-ring transition-ui group btn-label flex items-center justify-center gap-2 rounded-cta tracking-tight disabled:cursor-not-allowed',
        SIZE_CLASS[size],
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}
