'use client'

import { useState } from 'react'

export function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      setState('failed')
    }
    window.setTimeout(() => setState('idle'), 2_000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="focus-ring transition-ui admin-btn admin-btn-quiet admin-btn-sm"
    >
      {state === 'copied' ? 'Tersalin' : state === 'failed' ? 'Gagal menyalin' : 'Salin'}
      <span className="sr-only"> nomor rekening</span>
    </button>
  )
}
