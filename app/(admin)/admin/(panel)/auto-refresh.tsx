'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCredits, formatHistoryTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

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
    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          !live ? 'bg-muted-foreground' : pending ? 'bg-primary' : 'bg-success',
        )}
      />
      <p className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">
        <span className="text-foreground">
          {refreshedAt === null ? 'Baru dimuat' : formatHistoryTime(refreshedAt)}
        </span>
        <span aria-live="polite">
          {' · '}
          {pending
            ? 'memuat…'
            : live
              ? `segar lagi ${formatCredits(remaining)} dtk`
              : 'pembaruan otomatis dijeda'}
        </span>
      </p>
      <button
        type="button"
        onClick={() => setLive((current) => !current)}
        aria-pressed={live}
        className="focus-ring transition-ui shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        {live ? 'Jeda' : 'Lanjut'}
      </button>
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="focus-ring transition-ui shrink-0 rounded-lg bg-background px-2 py-1 text-[11px] font-medium text-foreground disabled:text-muted-foreground"
      >
        Muat ulang
      </button>
    </div>
  )
}
