import type { ComponentPropsWithRef, ElementType } from 'react'
import { cn } from '@/shared/lib/utils'

type SurfaceTone = 'muted' | 'solid' | 'danger'

type SurfaceProps<T extends ElementType> = {
  as?: T
  tone?: SurfaceTone
} & Omit<ComponentPropsWithRef<T>, 'as'>

export function Surface<T extends ElementType = 'div'>({
  as,
  tone = 'muted',
  className,
  ...props
}: SurfaceProps<T>) {
  const Component = as ?? 'div'

  return (
    <Component
      {...props}
      className={cn(
        'rounded-lg p-[var(--surface-p)]',
        tone === 'muted' && 'bg-muted/60',
        tone === 'solid' && 'bg-muted',
        tone === 'danger' && 'bg-destructive/10 text-destructive',
        className,
      )}
    />
  )
}
