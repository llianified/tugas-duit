'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApiError, sendJson } from '@/shell/api-client'

export function LoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !password) return

    setPending(true)
    setError(null)
    try {
      await sendJson('/api/admin/login', 'POST', { password })
      router.replace('/admin/dashboard')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Gagal masuk. Periksa koneksi lalu coba lagi.')
      setPending(false)
      setPassword('')
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-foreground">Kata sandi admin</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={Boolean(error)}
          className="focus-ring rounded-lg border border-border bg-background px-3 py-3 text-foreground"
        />
      </label>

      {error ? <p role="alert" className="rounded-lg border border-destructive px-3 py-2.5 text-sm font-medium text-destructive">{error}</p> : null}

      <button type="submit" disabled={pending || !password} className="focus-ring transition-ui rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground">
        {pending ? 'Memeriksa akses…' : 'Masuk ke panel'}
      </button>
    </form>
  )
}
