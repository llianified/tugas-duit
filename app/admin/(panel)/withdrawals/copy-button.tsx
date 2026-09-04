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
    setTimeout(() => setState('idle'), 2_000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted-foreground/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {state === 'copied' ? 'Tersalin' : state === 'failed' ? 'Gagal' : 'Salin'}
      <span className="sr-only"> nomor rekening</span>
    </button>
  )
}
