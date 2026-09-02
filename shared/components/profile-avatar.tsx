'use client'

import { useEffect, useState } from 'react'
import { GlyphUser } from '@/shared/components/glyph'
import { cn } from '@/shared/lib/utils'

export function ProfileAvatar({
  photoUrl,
  className,
  glyphClassName,
}: {
  photoUrl: string | null
  className?: string
  glyphClassName?: string
}) {
  const [photoBroken, setPhotoBroken] = useState(false)

  useEffect(() => {
    setPhotoBroken(false)
  }, [photoUrl])

  const showPhoto = photoUrl !== null && !photoBroken

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground',
        className,
      )}
    >
      {showPhoto ? (
        // Arbitrary provider-hosted avatar (Telegram/OAuth CDN) with an onError | fallback. `images.unoptimized` is on project-wide, so next/image would | emit this same tag plus wrapper overhead and no optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setPhotoBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        <GlyphUser className={cn('size-4', glyphClassName)} />
      )}
    </span>
  )
}
