'use client'
import { SheetIcon } from '@/shared/components/sheet-icon'

import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { MissionProgress, SocialMissionAction } from '@/domain/progression/missions'
import type {
  MissionActionTiming,
  MissionClockAnchor,
} from '@/features/missions/use-missions'
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
export const X_LIKE_REPOST_URL = 'https://x.com/TugasDuit/status/2095765886091276589'
export const FACEBOOK_HOME_URL = 'https://www.facebook.com/'
const AD_COPY = 'Kerjain soal singkat, kumpulin energi, dapetin reward'

export function buildTwitterShareText(referralShareUrl: string): string {
  return `${AD_COPY} bareng @Tugasduit.\n\nCoba aplikasinya: ${referralShareUrl}`
}

export function buildFacebookShareText(referralShareUrl: string): string {
  return `${AD_COPY} bareng Tugas Duit.\n\nCoba aplikasinya: ${referralShareUrl}`
}

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

export function secondsUntilConfirmation(
  timing: MissionActionTiming | null,
  deviceNow = Date.now(),
): number {
  if (!timing) return 0
  const projectedServerNow = timing.serverNow + (deviceNow - timing.receivedAt)
  return Math.max(0, Math.ceil((timing.confirmAt - projectedServerNow) / 1_000))
}

export function contentFor(action: SocialMissionAction) {
  if (action === 'twitter_follow') {
    return {
      instruction: 'Buka profil @tugasduit di X, terus tekan Follow.',
      actionLabel: 'Buka profil X',
      confirmation: 'Udah follow @tugasduit?',
      confirmLabel: 'Udah follow',
    }
  }
  if (action === 'twitter_like_repost') {
    return {
      instruction: 'Buka postingan Tugas Duit di X, terus Like dan Retweet postingan itu.',
      actionLabel: 'Buka postingan di X',
      confirmation: 'Udah di-Like dan di-Retweet?',
      confirmLabel: 'Udah keduanya',
    }
  }
  if (action === 'twitter_post') {
    return {
      instruction: 'Tekan tombol di bawah, terus posting ke X.',
      actionLabel: 'Buat post di Twitter',
      confirmation: 'Postingannya udah terbit?',
      confirmLabel: 'Udah diposting',
    }
  }
  return {
    instruction: 'Tekan tombol di bawah — teksnya kesalin sendiri, terus tinggal tempel di grup Facebook mana pun.',
    actionLabel: 'Salin teks dan buka Facebook',
    confirmation: 'Teksnya udah kamu posting di grup?',
    confirmLabel: 'Udah diposting',
  }
}

export function SocialMissionSheet({
  mission,
  clock,
  referralShareUrl,
  starting,
  claiming,
  onOpenChange,
  onStart,
  onConfirm,
}: {
  mission: MissionProgress
  clock: MissionClockAnchor | null
  referralShareUrl: string
  starting: boolean
  claiming: boolean
  onOpenChange: (open: boolean) => void
  onStart: () => Promise<MissionActionTiming | null>
  onConfirm: () => Promise<boolean>
}) {
  const details = contentFor(mission.action as SocialMissionAction)
  const [timing, setTiming] = useState<MissionActionTiming | null>(() => {
    if (mission.confirmAt === null) return null
    const receivedAt = clock?.receivedAt ?? Date.now()
    return {
      confirmAt: mission.confirmAt,
      serverNow: clock?.serverNow ?? receivedAt,
      receivedAt,
    }
  })
  const [remaining, setRemaining] = useState(() => secondsUntilConfirmation(timing))
  const [copied, setCopied] = useState(false)
  const showError = useToast()
  const needsReferralLink =
    mission.action === 'twitter_post' || mission.action === 'facebook_post'
  const shareText =
    mission.action === 'twitter_post'
      ? buildTwitterShareText(referralShareUrl)
      : buildFacebookShareText(referralShareUrl)

  useEffect(() => {
    if (timing === null) return
    const tick = () => setRemaining(secondsUntilConfirmation(timing))
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [timing])

  async function beginAction() {
    if (needsReferralLink && !referralShareUrl) {
      showError('Link kamu lagi disiapkan. Coba lagi sebentar ya.')
      return
    }

    const startRequest = onStart()
    let copyRequest: Promise<void> | null = null

    if (mission.action === 'twitter_follow') {
      openExternal(X_FOLLOW_URL)
    } else if (mission.action === 'twitter_like_repost') {
      openExternal(X_LIKE_REPOST_URL)
    } else if (mission.action === 'twitter_post') {
      const intent = new URL('https://twitter.com/intent/tweet')
      intent.searchParams.set('text', shareText)
      openExternal(intent.toString())
    } else {
      copyRequest = navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(shareText)
        : Promise.reject(new Error('Penyalinan teks tidak didukung peramban ini'))
      openExternal(FACEBOOK_HOME_URL)
    }

    const nextTiming = await startRequest
    if (nextTiming !== null) setTiming(nextTiming)

    if (copyRequest) {
      try {
        await copyRequest
        setCopied(true)
      } catch {
        showError('Teksnya belum kesalin. Coba tekan tombolnya sekali lagi ya.')
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
            <SheetIcon>
              <GlyphShare className="size-4" />
            </SheetIcon>
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
                  {copied ? 'Teksnya udah kesalin' : 'Teksnya kesalin sendiri pas tombolnya ditekan'}
                </p>
              </div>
            ) : null}

            {timing === null ? (
              <ActionButton
                className="mt-4"
                onClick={beginAction}
                disabled={starting || (needsReferralLink && !referralShareUrl)}
                aria-busy={starting || (needsReferralLink && !referralShareUrl)}
              >
                {starting || (needsReferralLink && !referralShareUrl) ? (
                  <GlyphSpinner className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <GlyphShare className="size-4" />
                )}
                {needsReferralLink && !referralShareUrl
                  ? 'Bentar ya…'
                  : starting
                    ? 'Menyiapkan…'
                    : details.actionLabel}
              </ActionButton>
            ) : remaining > 0 ? (
              <>
                <ActionButton className="mt-4" disabled>
                  Tunggu {remaining} detik
                </ActionButton>
                <p role="status" className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
                  Kelarin dulu di tab yang kebuka. Tombol konfirmasinya nyala setelah hitung mundurnya habis.
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
                <ActionButton
                  className="mt-2"
                  variant="ghost"
                  onClick={beginAction}
                  disabled={starting || (needsReferralLink && !referralShareUrl)}
                >
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
