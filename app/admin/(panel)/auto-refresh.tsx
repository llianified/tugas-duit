'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Strip satu baris, bukan kartu: statusnya penting tapi tidak layak memakan tinggi layar ponsel. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  const [live, setLive] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  useEffect(() => {
    setRefreshedAt(Date.now())
    setNow(Date.now())
  }, [])

  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && !pending) {
      setRefreshedAt(Date.now())
      setNow(Date.now())
    }
    wasPending.current = pending
  }, [pending])

  useEffect(() => {
    if (!live || refreshedAt === null) return

    const tick = () => {
      setNow(Date.now())
      if (document.hidden) return
      if (Date.now() - refreshedAt >= seconds * 1_000) refresh()
    }

    const timer = setInterval(tick, 1_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [live, seconds, refresh, refreshedAt])

  const remaining =
    refreshedAt === null || now === null
      ? seconds
      : Math.max(0, Math.ceil((refreshedAt + seconds * 1_000 - now) / 1_000))

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          !live ? 'bg-muted-foreground' : pending ? 'bg-primary' : 'bg-success',
        )}
      />
      <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" aria-live="polite">
        {pending
          ? 'Memuat data terbaru'
          : live
            ? `Segar otomatis ${formatCredits(remaining)} dtk lagi`
            : 'Pembaruan otomatis dijeda'}
      </p>
      <button
        type="button"
        onClick={() => setLive((current) => !current)}
        aria-pressed={live}
        className="focus-ring transition-ui shrink-0 rounded-md px-1.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
      >
        {live ? 'Jeda' : 'Nyalakan'}
      </button>
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="focus-ring transition-ui shrink-0 rounded-md px-1.5 py-1 text-[11px] font-bold text-primary disabled:text-muted-foreground"
      >
        Muat ulang
      </button>
    </div>
  )
}
