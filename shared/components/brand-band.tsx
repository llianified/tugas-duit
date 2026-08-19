import type { ReactNode } from 'react'

export function BrandBand({
  children,
  control,
}: {
  children?: ReactNode
  control?: ReactNode
}) {
  if (!children && !control) return null

  return (
    <div className="brand-band">
      <div className="brand-band-row">
        {children}
        {control}
      </div>
    </div>
  )
}
