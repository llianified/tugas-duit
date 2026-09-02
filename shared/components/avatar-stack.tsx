'use client'

import { ProfileAvatar } from '@/features/home/profile-avatar'
import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Avatar bertumpuk ala fomo: beberapa avatar saling menindih, lalu sisanya diringkas jadi satu lingkaran `65+`. Dipakai untuk memadatkan daftar panjang (lencana, anggota) ke dalam ruang selebar satu nilai di baris daftar 384px. Ring-nya berwarna `background` — itu yang memisahkan avatar yang saling menindih. Karena warnanya diambil dari token, komponen ini akan salah kalau dipasang di atas permukaan lain; prop `ringTone` menyediakan `card` untuk pemakaian di dalam kartu. Aksesibilitas: tumpukan ini adalah **satu** informasi ringkas, bukan daftar yang perlu ditelusuri satu-satu. Jadi wadahnya `role="img"` + `aria-label` yang bermakna, yang membuat seluruh isinya presentasional — termasuk penghitung sisa, yang kalau dibacakan hanya berbunyi "65 tambah" tanpa konteks. Avatarnya sendiri tidak perlu `aria-hidden` tambahan: `role="img"` sudah memangkas subtree-nya, dan `ProfileAvatar` merender `alt=""`. `ProfileAvatar` dipakai apa adanya supaya penanganan gambar gagal muat (`onError` → glyph pengganti) tidak ditulis dua kali. */
export type AvatarStackItem = {
  id: string
  photoUrl: string | null
}

export type AvatarStackSize = 'sm' | 'md'

const AVATAR_SIZE: Record<AvatarStackSize, string> = {
  sm: 'size-5',
  md: 'size-6',
}

const GLYPH_SIZE: Record<AvatarStackSize, string> = {
  sm: 'size-2.5',
  md: 'size-3',
}

const COUNTER_TEXT: Record<AvatarStackSize, string> = {
  sm: 'text-[9px]',
  md: 'text-[10px]',
}

/** Tumpang-tindihnya negatif margin, bukan `translate`: ia ikut mengecilkan lebar total sehingga baris di sebelahnya tidak perlu tahu berapa avatar yang tampil. */
const OVERLAP: Record<AvatarStackSize, string> = {
  sm: '-ml-1.5',
  md: '-ml-2',
}

export function AvatarStack({
  items,
  limit = 3,
  ariaLabel,
  size = 'md',
  ringTone = 'background',
  className,
}: {
  items: readonly AvatarStackItem[]
  /** Berapa avatar yang ditampilkan sebelum sisanya diringkas. */
  limit?: number
  ariaLabel: string
  size?: AvatarStackSize
  ringTone?: 'background' | 'card'
  className?: string
}) {
  // Daftar kosong tidak menyisakan apa pun untuk dibaca, jadi jangan tinggalkan | wadah ber-`aria-label` yang mengumumkan tumpukan tak berisi.
  if (items.length === 0) return null

  const shown = items.slice(0, Math.max(1, limit))
  const rest = items.length - shown.length
  const ring = ringTone === 'card' ? 'ring-card' : 'ring-background'

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn('flex shrink-0 items-center', className)}
    >
      {shown.map((item, index) => (
        <ProfileAvatar
          key={item.id}
          photoUrl={item.photoUrl}
          className={cn(
            AVATAR_SIZE[size],
            'ring-[1.5px]',
            ring,
            index > 0 && OVERLAP[size],
          )}
          glyphClassName={GLYPH_SIZE[size]}
        />
      ))}

      {rest > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center rounded-full bg-muted font-bold tabular-nums text-muted-foreground',
            AVATAR_SIZE[size],
            COUNTER_TEXT[size],
            'ring-[1.5px]',
            ring,
            OVERLAP[size],
          )}
        >
          {formatCredits(rest)}+
        </span>
      ) : null}
    </span>
  )
}
