'use client'

import { useState } from 'react'
import { ActionButton } from '@/shared/components/action-button'

export function CopyButton({ value, label = 'nomor rekening' }: { value: string; label?: string }) {
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
    <ActionButton variant="soft" size="micro" className="w-auto" onClick={copy}>
      {state === 'copied' ? 'Tersalin' : state === 'failed' ? 'Gagal' : 'Salin'}
      <span className="sr-only"> {label}</span>
    </ActionButton>
  )
}
