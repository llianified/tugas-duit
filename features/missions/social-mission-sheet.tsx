'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  SOCIAL_MISSION_COOLDOWN_MS,
  type MissionProgress,
  type SocialMissionAction,
} from '@/domain/progression/missions'
import { ActionButton } from '@/shared/components/action-button'
import {
  GlyphBolt,
  GlyphCheck,
  GlyphCopy,
  GlyphCross,
  GlyphShare,
  GlyphSpinner,
} from '@/shared/components/glyph'
import { Surface } from '@/shared/components/surface'
import { formatCredits } from '@/shared/lib/format'
import { useToast } from '@/shell/toast'

const X_FOLLOW_URL = 'https://twitter.com/intent/follow?screen_name=tugasduit'
const FACEBOOK_GROUPS_URL = 'https://www.facebook.com/groups/feed/'
const AD_COPY =
  'Kerjakan task singkat, kumpulkan energi, dan dapatkan reward bareng Tugas Duit.'

type TelegramWebApp = {
  openLink?: (url: string) => void
}

function openExternal(url: string): void {
  const webApp = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
  if (webApp?.openLink) {
    webApp.openLink(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

function contentFor(action: SocialMissionAction) {
  if (action === 'twitter_follow') {
    return {
      instruction: 'Buka profil @tugasduit di X, lalu tekan Follow.',
      actionLabel: 'Buka profil X',
      confirmation: 'Sudah follow akun @tugasduit?',
      confirmLabel: 'Ya, sudah follow',
    }
  }
  if (action === 'twitter_post') {
    return {
      instruction: 'Buka composer X dengan teks promosi yang sudah kami siapkan, lalu post.',
      actionLabel: 'Buat post di X',
      confirmation: 'Post tentang Tugas Duit sudah terbit?',
      confirmLabel: 'Ya, sudah diposting',
    }
  }
  return {
    instruction: 'Salin teks promosi, buka daftar grup Facebook, lalu tempel dan post manual.',
    actionLabel: 'Salin & buka Facebook',
    confirmation: 'Teksnya sudah diposting di grup Facebook?',
    confirmLabel: 'Ya, sudah diposting',
  }
}

export function SocialMissionSheet({
  mission,
  botAppUrl,
  starting,
  claiming,
  onOpenChange,
  onStart,
  onConfirm,
}: {
  mission: MissionProgress
  botAppUrl: string | null
  starting: boolean
  claiming: boolean
  onOpenChange: (open: boolean) => void
  onStart: () => Promise<number | null>
  onConfirm: () => Promise<boolean>
}) {
  const details = contentFor(mission.action as SocialMissionAction)
  const [availableAt, setAvailableAt] = useState<number | null>(() =>
    mission.actionStartedAt === null
      ? null
      : mission.actionStartedAt + SOCIAL_MISSION_COOLDOWN_MS,
  )
  const [remaining, setRemaining] = useState(() =>
    availableAt === null ? 0 : Math.max(0, Math.ceil((availableAt - Date.now()) / 1_000)),
  )
  const [copied, setCopied] = useState(false)
  const showError = useToast()
  const shareText = botAppUrl
    ? `${AD_COPY}\n\nCoba aplikasinya: ${botAppUrl}`
    : AD_COPY

  useEffect(() => {
    if (availableAt === null) return
    const tick = () => setRemaining(Math.max(0, Math.ceil((availableAt - Date.now()) / 1_000)))
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [availableAt])

  async function beginAction() {
    const startRequest = onStart()
    let copyRequest: Promise<void> | null = null

    if (mission.action === 'twitter_follow') {
      openExternal(X_FOLLOW_URL)
    } else if (mission.action === 'twitter_post') {
      const intent = new URL('https://twitter.com/intent/tweet')
      intent.searchParams.set('text', shareText)
      openExternal(intent.toString())
    } else {
      copyRequest = navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(shareText)
        : Promise.reject(new Error('Clipboard tidak tersedia'))
      openExternal(FACEBOOK_GROUPS_URL)
    }

    const nextAvailableAt = await startRequest
    if (nextAvailableAt !== null) setAvailableAt(nextAvailableAt)

    if (copyRequest) {
      try {
        await copyRequest
        setCopied(true)
      } catch {
        showError('Teks belum tersalin. Izinkan akses clipboard, lalu coba lagi.')
      }
    }
  }

  async function confirm() {
    if (await onConfirm()) onOpenChange(false)
  }

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-40 bg-scrim duration-150" />
        <Dialog.Popup className="sheet-popup">
          <div className="sheet-grip" aria-hidden="true" />

          <div className="flex shrink-0 items-center gap-3 px-content pt-3">
            <span className="stamp-portrait">
              <GlyphShare className="size-4 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold tracking-tight text-foreground">
                {mission.title}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                Hadiah +{formatCredits(mission.reward)} energi
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Tutup"
              className="focus-ring transition-ui relative -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
            >
              <GlyphCross className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-content pb-[var(--content-px)] pt-4">
            <Surface>
              <p className="text-sm font-semibold tracking-tight text-foreground">Langkah misi</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                {details.instruction}
              </p>
            </Surface>

            {mission.action === 'facebook_post' ? (
              <div className="mt-3 rounded-lg border border-border p-3">
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {shareText}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  {copied ? <GlyphCheck className="size-3.5" /> : <GlyphCopy className="size-3.5" />}
                  {copied ? 'Teks sudah disalin' : 'Teks akan disalin saat tombol ditekan'}
                </p>
              </div>
            ) : null}

            {availableAt === null ? (
              <ActionButton className="mt-4" onClick={beginAction} disabled={starting} aria-busy={starting}>
                {starting ? (
                  <GlyphSpinner className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <GlyphShare className="size-4" />
                )}
                {starting ? 'Menyiapkan…' : details.actionLabel}
              </ActionButton>
            ) : remaining > 0 ? (
              <>
                <ActionButton className="mt-4" disabled>
                  Tunggu {remaining} detik
                </ActionButton>
                <p role="status" className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
                  Selesaikan aksinya di tab yang terbuka. Konfirmasi aktif setelah hitung mundur.
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 text-center text-sm font-semibold tracking-tight text-foreground text-balance">
                  {details.confirmation}
                </p>
                <ActionButton className="mt-3" onClick={confirm} disabled={claiming} aria-busy={claiming}>
                  {claiming ? (
                    <GlyphSpinner className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <GlyphBolt className="size-4" />
                  )}
                  {claiming ? 'Memeriksa…' : `${details.confirmLabel} · +${formatCredits(mission.reward)}`}
                </ActionButton>
                <ActionButton className="mt-2" variant="ghost" onClick={beginAction} disabled={starting}>
                  Buka lagi
                </ActionButton>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
