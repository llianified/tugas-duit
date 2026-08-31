'use client'

import { useCallback, useState } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphTelegram } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { userFacingMessage } from '@/shell/api-client'
import { verifyChannelMembership, type ChannelGateState } from '@/shell/session-api'

export function ChannelGate({
  gate,
  onVerified,
}: {
  gate: ChannelGateState
  onVerified: () => Promise<unknown>
}) {
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const verify = useCallback(async () => {
    setMessage(null)
    setChecking(true)
    try {
      const next = await verifyChannelMembership()
      if (next.required && !next.member) {
        setMessage('Kamu masih belum kelihatan jadi anggota channel. Join dulu, baru tekan lagi ya.')
        return
      }
      await onVerified()
    } catch (cause) {
      setMessage(userFacingMessage(cause))
    } finally {
      setChecking(false)
    }
  }, [onVerified])

  return (
    <section
      aria-label="Wajib join channel"
      className="flex flex-1 flex-col items-center justify-center text-center"
    >
      <IconCircle size="lg" tone="primary">
        <GlyphTelegram className="size-6" />
      </IconCircle>

      <h1 className="label-gap-t font-sans text-xl font-semibold tracking-tight text-foreground">
        Join channel dulu ya
      </h1>
      <p className="stack-gap-t max-w-[17rem] text-sm leading-relaxed text-pretty text-muted-foreground">
        Tugas Duit cuma bisa dipakai anggota channel Telegram kami. Semua pengumuman
        pembayaran dan perubahan aturan diumumkan di sana.
      </p>

      {message ? (
        <p className="stack-gap-t max-w-[17rem] text-xs leading-relaxed text-destructive">
          {message}
        </p>
      ) : null}

      <div className="stack-gap-t flex w-full max-w-xs flex-col gap-2">
        <a
          href={gate.url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring transition-ui press-scale-soft control-h flex items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover active:bg-primary-active"
        >
          Buka channel
        </a>
        <ActionButton variant="ghost" onClick={verify} disabled={checking}>
          {checking ? 'Mengecek…' : 'Saya sudah join'}
        </ActionButton>
      </div>
    </section>
  )
}
