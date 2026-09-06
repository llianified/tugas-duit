'use client'

import type { ReactNode } from 'react'
import { IconCircle } from '@/shared/components/icon-circle'

export function EmptyState({
  icon,
  title,
  description,
  footer,
}: {
  icon: ReactNode
  title: string
  description: string
  /** Satu keterangan tambahan di bawah kalimatnya — chip, bukan tombol.
   *
   * Ada karena sebagian keadaan kosong bukan "belum ada apa-apa" melainkan "belum ada apa-apa DI
   * DALAM jendela yang sedang berlaku", dan tanpa menyebut jendelanya, layar kosong terbaca
   * seperti fitur yang rusak. Sengaja bukan slot aksi: yang mengajak sudah kalimat di atasnya, dan
   * dua ajakan di satu layar kosong saling melemahkan. */
  footer?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <IconCircle tone="card">{icon}</IconCircle>

      <p className="label-gap-t text-base font-semibold tracking-tight">{title}</p>
      <p className="stack-gap-t max-w-[15rem] text-sm leading-relaxed text-muted-foreground text-pretty">
        {description}
      </p>
      {footer ? <div className="stack-gap-t">{footer}</div> : null}
    </div>
  )
}
