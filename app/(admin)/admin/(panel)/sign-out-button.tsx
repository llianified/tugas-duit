'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sendJson } from '@/shell/api-client'

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      await sendJson('/api/session', 'DELETE')
    } catch {
    }
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="focus-ring rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted-foreground/15 hover:text-foreground disabled:opacity-50"
    >
      {pending ? 'Keluar…' : 'Keluar'}
    </button>
  )
}
