import type { ReactNode } from 'react'

export function BrandBand({ children }: { children?: ReactNode }) {
  if (!children) return null

  return (
    <div className="brand-band">
      <div className="brand-band-row">{children}</div>
    </div>
  )
}
