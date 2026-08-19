import type { ComponentPropsWithRef } from 'react'
import { cn } from '@/shared/lib/utils'

type IconCircleSize = 'xs' | 'sm' | 'md' | 'lg'
type IconCircleTone = 'muted' | 'card' | 'success' | 'primary'

const SIZE_CLASS: Record<IconCircleSize, string> = {
  xs: 'size-5 text-xs',
  sm: 'size-7 text-xs',
  md: 'size-10',
  lg: 'size-12',
}

export function IconCircle({
  size = 'md',
  tone = 'muted',
  className,
  ...props
}: ComponentPropsWithRef<'span'> & { size?: IconCircleSize; tone?: IconCircleTone }) {
  return (
    <span
      {...props}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        SIZE_CLASS[size],
        tone === 'muted' && 'bg-muted text-muted-foreground',
        tone === 'card' && 'bg-muted/60 text-muted-foreground',
        tone === 'success' && 'bg-success/10 text-success',
        tone === 'primary' && 'bg-primary/10 text-primary',
        className,
      )}
    />
  )
}
