'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApiError, sendJson } from '@/shell/api-client'

/** Satu bidang, satu tombol selebar kartu. Kesalahan muncul di antara keduanya supaya terbaca tanpa menggeser posisi tombol yang sedang disentuh. */
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
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <label className="admin-field">
        <span className="admin-field-k">Kata sandi admin</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={Boolean(error)}
          className="focus-ring admin-input"
        />
      </label>

      {error ? (
        <p role="alert" className="admin-note" data-tone="danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !password}
        className="focus-ring transition-ui admin-btn admin-btn-primary"
      >
        {pending ? 'Memeriksa akses…' : 'Masuk ke panel'}
      </button>
    </form>
  )
}
