'use client'

import { useCallback, useState } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphTelegram } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { userFacingMessage } from '@/shell/api-client'
import { useToast } from '@/shell/toast'
import { verifyChannelMembership, type ChannelGateState } from '@/shell/session-api'

/** Gerbangnya menahan cara MENGHASILKAN credit, bukan cara mengambil yang sudah terkumpul. `channelGateEnabled` di panel menjanjikan itu apa adanya — "penarikan saldo tidak pernah ikut diblokir" — dan `docs/keputusan-desain.md` memberi alasannya: memblokirnya menyandera saldo yang terkumpul SEBELUM gerbangnya dinyalakan, dan itu tidak menutup celah apa pun karena penarikan tidak mencetak credit. Server memang tidak pernah menjaganya (`channelGateBlocks` cuma dipasang di `POST /api/task/start`), tapi klien sempat mengganti seluruh pohon aplikasi dengan layar ini — termasuk dialog penarikannya — sehingga janji itu tidak pernah benar-benar berlaku. `onWithdraw` adalah jalan keluarnya; `null` saat memang tidak ada yang bisa ditarik maupun ditengok. */
export function ChannelGate({
  gate,
  onVerified,
  onWithdraw,
}: {
  gate: ChannelGateState
  onVerified: () => Promise<unknown>
  onWithdraw: (() => void) | null
}) {
  const [checking, setChecking] = useState(false)
  const showError = useToast()

  const verify = useCallback(async () => {
    setChecking(true)
    try {
      const next = await verifyChannelMembership()
      if (next.required && !next.member) {
        showError('Kamu belum terdeteksi join. Join dulu, lalu cek lagi.')
        return
      }
      await onVerified()
    } catch (cause) {
      showError(userFacingMessage(cause))
    } finally {
      setChecking(false)
    }
  }, [onVerified, showError])

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
        Tugas Duit khusus anggota channel. Kabar pembayaran dan perubahan aturan diumumin di sana.
        {onWithdraw ? ' Saldo yang sudah terkumpul tetap bisa ditarik.' : ''}
      </p>

      <div className="stack-gap-t flex w-full max-w-xs flex-col gap-2">
        <a
          href={gate.url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring transition-ui press-scale-soft button-h btn-label flex items-center justify-center rounded-cta btn-glass bg-primary font-extrabold tracking-tight text-primary-foreground hover:bg-primary-hover active:bg-primary-active"
        >
          Buka channel
        </a>
        <ActionButton variant="ghost" onClick={verify} disabled={checking}>
          {checking ? 'Mengecek…' : 'Saya sudah join'}
        </ActionButton>
        {onWithdraw ? (
          <ActionButton variant="quiet" onClick={onWithdraw}>
            Tarik dana
          </ActionButton>
        ) : null}
      </div>
    </section>
  )
}
