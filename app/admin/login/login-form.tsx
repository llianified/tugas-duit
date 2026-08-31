'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { TextInput } from '@/shared/components/input'
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
      router.replace('/admin/withdrawals')
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Gagal masuk. Periksa koneksi lalu coba lagi.',
      )
      setPending(false)
      setPassword('')
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-foreground">Kata sandi admin</span>
        <TextInput
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <ActionButton type="submit" disabled={pending || !password}>
        {pending ? 'Memeriksa…' : 'Masuk'}
      </ActionButton>
    </form>
  )
}
