import type { ReactNode } from 'react'
import { CreditAmount } from '@/shared/components/credit-amount'
import { IconCircle } from '@/shared/components/icon-circle'
import { cn } from '@/shared/lib/utils'

export function ResultPanel({
  icon,
  title,
  credits,
  rupiah,
  prefix,
  tone = 'neutral',
  amountSize = 'xl',
  children,
  childrenAfterAmount = false,
  className,
}: {
  icon?: ReactNode
  title?: string
  credits: string
  rupiah: string
  prefix?: string
  tone?: 'primary' | 'neutral'
  amountSize?: 'xl' | '2xl'
  children?: ReactNode
  childrenAfterAmount?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center',
        className,
      )}
    >
      {icon ? (
        <IconCircle size="lg" tone="success" className="animate-pop-in">
          {icon}
        </IconCircle>
      ) : null}
      {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : null}
      {!childrenAfterAmount ? children : null}
      <CreditAmount value={credits} prefix={prefix} size={amountSize} tone={tone} />
      <p className="text-sm leading-none tabular-nums text-muted-foreground">{rupiah}</p>
      {childrenAfterAmount ? children : null}
    </div>
  )
}
