import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** Ikon di kepala sheet: kotak membulat berisi penuh, bukan lingkaran bertint.
 *
 * Bentuknya diambil dari sheet Event Turbo Reward, satu-satunya yang sudah memakainya — tiga sheet
 * lain (tarik dana, premium, misi sosial) memakai `.stamp-portrait`, lingkaran tint 20% yang
 * dirancang untuk menumpang PELAT perangko di kartu beranda. Di luar pelat itu latarnya gelap
 * aplikasi, jadi tint yang sama jatuh jadi bidang nyaris hitam: bentuk yang sama, hasil yang tidak
 * sama. Kotak berisi penuh tidak bergantung pada apa pun di belakangnya.
 *
 * `.stamp-portrait` tetap dipakai DI DALAM kartu perangko — di sana ia potret perangko, dan
 * lingkarannya bagian dari bentuk kertas itu, bukan pilihan ikon yang berdiri sendiri. */
export function SheetIcon({
  children,
  tone = 'primary',
}: {
  children: ReactNode
  /** `premium` memakai emas, satu-satunya warna yang di app ini berarti berbayar. */
  tone?: 'primary' | 'premium'
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        tone === 'premium' ? 'bg-premium text-background' : 'bg-primary text-primary-foreground',
      )}
    >
      {children}
    </span>
  )
}
