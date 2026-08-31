'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ActionButton } from '@/shared/components/action-button'
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
    <ActionButton variant="ghost" size="compact" className="w-auto" onClick={signOut} disabled={pending}>
      {pending ? 'Keluar…' : 'Keluar'}
    </ActionButton>
  )
}
