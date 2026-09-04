'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sendJson } from '@/shell/api-client'

/** Tanpa header atas, keluar dari sesi hidup di kaki halaman Pantau — satu-satunya layar yang selalu jadi tujuan pertama admin. */
export function SignOutButton({ adminName }: { adminName: string }) {
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
    <div className="admin-row">
      <div className="admin-row-main">
        <span className="admin-row-title">Masuk sebagai {adminName}</span>
        <span className="admin-sub">Sesi admin di perangkat ini</span>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="focus-ring transition-ui admin-btn admin-btn-quiet admin-btn-sm"
      >
        {pending ? 'Keluar…' : 'Keluar'}
      </button>
    </div>
  )
}
