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
    <div className="admin-refresh">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 shrink-0 rounded-full',
            !live ? 'bg-muted-foreground' : pending ? 'bg-primary' : 'bg-success',
          )}
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            {pending ? 'Memperbarui data' : live ? 'Data diperbarui otomatis' : 'Pembaruan dijeda'}
          </p>
          <p className="truncate text-xs text-muted-foreground" aria-live="polite">
            {refreshedAt === null ? 'Baru dimuat' : formatHistoryTime(refreshedAt)}
            {live && !pending ? ` · berikutnya ${formatCredits(remaining)} dtk` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setLive((current) => !current)}
          aria-pressed={live}
          className="focus-ring transition-ui rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {live ? 'Jeda' : 'Aktifkan'}
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="focus-ring transition-ui rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:text-muted-foreground"
        >
          Muat ulang
        </button>
      </div>
    </div>
  )
}
