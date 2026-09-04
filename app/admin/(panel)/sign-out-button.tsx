'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sendJson } from '@/shell/api-client'
import { cn } from '@/shared/lib/utils'

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      await sendJson('/api/session', 'DELETE')
    } catch {
      // Tetap arahkan ke login saat sesi sudah hilang atau jaringan gagal.
    }
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={cn(
        'focus-ring transition-ui shrink-0 rounded-lg border border-border font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50',
        compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2 text-sm',
      )}
    >
      {pending ? 'Keluar…' : 'Keluar'}
    </button>
  )
}
