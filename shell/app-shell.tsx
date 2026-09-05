'use client'

import { MotionConfig } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { SWRConfig } from 'swr'
import { economyConfig } from '@/domain/economy/economy-config'
import { getWithdrawalStatus } from '@/domain/economy/economy'
import { inAppAdsSettings } from '@/domain/ads/in-app-ads'
import { ChannelGate } from '@/features/channel/channel-gate'
import { WithdrawDialog } from '@/features/withdraw/components/withdraw-dialog'
import { getProgression } from '@/domain/progression/progression'
import { ProgressionBadges } from '@/features/home/progression-badges'
import { NavPill } from '@/navigation/nav-pill'
import { AppFrame } from '@/shell/app-frame'
import { AppViewRouter } from '@/shell/app-view-router'
import { BootSplash } from '@/shell/boot-splash'
import { useBootSplash } from '@/shell/use-boot-splash'
import { ToastProvider, useToast } from '@/shell/toast'
import { useTelegramViewport } from '@/shell/telegram-viewport'
import { inAppZoneId, useInAppAds } from '@/shell/use-in-app-ads'
import { useRewardSession } from '@/shell/use-reward-session'

/** Jendela throttle `revalidateOnFocus`, dan default SWR 5 detik bocor besar di Mini App: alur
 * intinya menonton iklan, tiap tayangan mengembalikan fokus ke dokumen, dan tiap kembalinya itu
 * menembakkan ulang SELURUH kunci SWR yang sedang terpasang sekaligus. Terbaca di Observability
 * sebagai `/api/withdrawals` 18K melawan `/` 4,5K — satu endpoint tanpa polling dan tanpa pemanggil
 * lain, ditembak empat kali per app dibuka. Yang dijaga di sini pengalinya, bukan `revalidateOnFocus`
 * itu sendiri: jalur itu yang menangkap pembayaran premium saat user balik dari aplikasi banknya,
 * dan pembayaran tidak pernah selesai di bawah semenit. */
const FOCUS_THROTTLE_MS = 60_000

export function AppShell() {
  return (
    <SWRConfig value={{ focusThrottleInterval: FOCUS_THROTTLE_MS }}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AppShellInner />
        </ToastProvider>
      </MotionConfig>
    </SWRConfig>
  )
}

function AppShellInner() {
  useTelegramViewport()
  const showError = useToast()
  const session = useRewardSession({ onError: showError })
  /** Splash menutupi seluruh boot, jadi ia dirender berdampingan dengan `AppFrame` alih-alih di
   * dalamnya: frame itu yang membawa nav, brand band, dan kunci scroll, dan splash tidak boleh
   * ikut terpotong oleh salah satunya. */
  const splashPhase = useBootSplash(!session.loading)
  const [liveTaskReward, setLiveTaskReward] = useState<number | null>(null)
  const [gateWithdrawOpen, setGateWithdrawOpen] = useState(false)

  /** Interstitial otomatis punya saklarnya sendiri, `ads.inAppEnabled`, terpisah dari `ads.enabled` milik iklan berhadiah. Keduanya sama-sama mati saat `adsMaxViewsPerDay` diisi 0 di panel ekonomi, tapi premium hanya mematikan yang ini — tiket berhadiah tetap dirender karena sifatnya opt-in. Dipasang di sini, bukan di `app/(miniapp)/layout.tsx`, karena saklarnya baru diketahui setelah sesi termuat. Jadwalnya dibaca dari config ekonomi yang dikirim `/api/session`, lalu di-memo per nilai agar effect tidak dijalankan ulang hanya karena identitas objek berubah. Hook mengirim konfigurasi `type: 'inApp'` satu kali per dokumen; timeout, interval, frequency, dan capping setelah itu dikelola langsung oleh SDK Monetag. */
  const {
    inAppAdsFrequency,
    inAppAdsCappingMinutes,
    inAppAdsIntervalSeconds,
    inAppAdsTimeoutSeconds,
  } = economyConfig()
  const adsSettings = useMemo(
    () =>
      inAppAdsSettings({
        inAppAdsFrequency,
        inAppAdsCappingMinutes,
        inAppAdsIntervalSeconds,
        inAppAdsTimeoutSeconds,
      }),
    [
      inAppAdsFrequency,
      inAppAdsCappingMinutes,
      inAppAdsIntervalSeconds,
      inAppAdsTimeoutSeconds,
    ],
  )
  const channelBlocked =
    !session.loading &&
    !session.sessionFailed &&
    !session.unauthenticated &&
    session.channelBlocked

  const activeChallenge = session.view === 'captcha' ? session.activeChallenge : null

  /** Pendaftaran jadwal ditahan selama ada task berjalan. Ini BUKAN jeda pada jadwal yang sudah terdaftar — Monetag tidak menyediakannya — melainkan penundaan tayangan pertama supaya ia tidak jatuh di dalam task yang bayarannya dihitung dari waktu. Lihat catatan panjang di `useInAppAds`. */
  useInAppAds({
    enabled: session.inAppAdsEnabled && !channelBlocked && activeChallenge === null,
    zoneId: inAppZoneId(),
    settings: adsSettings,
  })

  useEffect(() => {
    if (!session.sessionFailed) return
    showError(
      session.error ?? 'Koneksi putus. Cek internet, lalu muat ulang.',
    )
  }, [session.sessionFailed, session.error, showError])

  useEffect(() => {
    if (!session.unauthenticated) return
    showError('Buka Tugas Duit dari Telegram ya.')
  }, [session.unauthenticated, showError])

  const effectiveView = session.view === 'captcha' && !activeChallenge ? 'home' : session.view

  useEffect(() => {
    setLiveTaskReward(null)
  }, [activeChallenge?.id])

  const shellReady =
    !session.loading &&
    !session.sessionFailed &&
    !session.unauthenticated &&
    session.stats !== null

  const badgesVisible = shellReady && !channelBlocked

  const navVisible = shellReady && !channelBlocked && effectiveView !== 'captcha'

  /** Jalan keluar penarikan di layar gerbang: ditawarkan kalau ada yang bisa ditarik, atau ada pengajuan yang perlu ditengok statusnya. Di luar dua hal itu tombolnya cuma memindahkan kekecewaan satu ketukan lebih jauh — bentuk yang sama dengan `onOpenPremium` di kartu task. */
  const gateWithdrawReachable =
    getWithdrawalStatus(session.balance).eligible || session.withdrawals.length > 0

  const viewKey = session.loading
    ? 'loading'
    : session.sessionFailed
      ? 'session-failed'
      : session.unauthenticated
        ? 'unauthenticated'
        : channelBlocked
          ? 'channel-gate'
          : activeChallenge
            ? `captcha-${activeChallenge.id}`
            : effectiveView

  const [depthTracker, setDepthTracker] = useState<{ depth: number; direction: 1 | -1 }>({
    depth: session.viewDepth,
    direction: 1,
  })

  if (session.viewDepth !== depthTracker.depth) {
    setDepthTracker({
      depth: session.viewDepth,
      direction: session.viewDepth > depthTracker.depth ? 1 : -1,
    })
  }

  return (
    <>
      <BootSplash phase={splashPhase} />
      <AppFrame
          viewKey={viewKey}
        direction={depthTracker.direction}
        heroBand={session.loading || (!channelBlocked && !activeChallenge && effectiveView === 'home')}
        badges={
          badgesVisible ? (
            <ProgressionBadges
              progression={getProgression({
                completedCount: session.completedCount,
                streak: session.stats?.streak ?? 0,
                todayCount: session.stats?.todayCount ?? 0,
              })}
              user={session.user}
              stats={session.stats}
              premium={session.premium}
              showProfile={effectiveView !== 'captcha'}
              taskDifficulty={activeChallenge?.difficulty ?? null}
              taskReward={liveTaskReward}
              energy={session.energy}
              energyMax={session.energyMax}
              energyFill={session.energyFill}
              rewardPoolCredits={session.rewardPoolCredits}
              rewardPoolMax={session.rewardPoolMax}
              rewardPoolRegenCredits={session.rewardPoolRegenCredits}
              rewardPoolSecondsToNext={session.rewardPoolSecondsToNext}
              onOpenStats={session.openStats}
            />
          ) : null
        }
        nav={
          navVisible ? (
            <NavPill
              activeView={effectiveView}
              photoUrl={session.user?.photoUrl ?? null}
              missionsNeedAttention={session.missionsNeedAttention}
              onSelect={session.selectView}
            />
          ) : null
        }
      >
        {channelBlocked && session.channelGate ? (
          <>
            <ChannelGate
              gate={session.channelGate}
              onVerified={session.refreshSession}
              onWithdraw={
                gateWithdrawReachable
                  ? () => {
                      session.primeWithdrawals()
                      setGateWithdrawOpen(true)
                    }
                  : null
              }
            />
            {/* Dialognya dirender di sini, bukan di dalam `ChannelGate`, supaya lapisan `features` tidak saling mengimpor — komposisi lintas fitur memang tugas `shell`. */}
            <WithdrawDialog
              open={gateWithdrawOpen}
              onOpenChange={setGateWithdrawOpen}
              balance={session.balance}
              withdrawals={session.withdrawals}
              eligibility={session.withdrawalEligibility}
              onSubmit={session.submitWithdrawal}
            />
          </>
        ) : (
          <AppViewRouter
            session={session}
            activeChallenge={activeChallenge}
            effectiveView={effectiveView}
            showError={showError}
            onTaskRewardChange={setLiveTaskReward}
          />
        )}
      </AppFrame>
    </>
  )
}
