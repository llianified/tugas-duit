'use client'

import { MotionConfig } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
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
import { ToastProvider, useToast } from '@/shell/toast'
import { useTelegramViewport } from '@/shell/telegram-viewport'
import { inAppZoneId, useInAppAds } from '@/shell/use-in-app-ads'
import { useRewardSession } from '@/shell/use-reward-session'

export function AppShell() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AppShellInner />
      </ToastProvider>
    </MotionConfig>
  )
}

function AppShellInner() {
  useTelegramViewport()
  const showError = useToast()
  const session = useRewardSession({ onError: showError })
  const [liveTaskReward, setLiveTaskReward] = useState<number | null>(null)
  const [gateWithdrawOpen, setGateWithdrawOpen] = useState(false)

  /** Interstitial otomatis punya saklarnya sendiri, `ads.inAppEnabled`, terpisah dari `ads.enabled` milik iklan berhadiah. Keduanya sama-sama mati saat `adsMaxViewsPerDay` diisi 0 di panel ekonomi, tapi premium hanya mematikan yang ini — tiket berhadiah tetap dirender karena sifatnya opt-in. Dipasang di sini, bukan di `app/layout.tsx`, karena saklarnya baru diketahui setelah sesi termuat. Jadwalnya dibaca dari config ekonomi yang dikirim `/api/session`, lalu di-memo per nilai agar effect tidak dijalankan ulang hanya karena identitas objek berubah. Hook mengirim konfigurasi `type: 'inApp'` satu kali per dokumen; timeout, interval, frequency, dan capping setelah itu dikelola langsung oleh SDK Monetag. */
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

  useInAppAds({
    enabled: session.inAppAdsEnabled && !channelBlocked,
    zoneId: inAppZoneId(),
    settings: adsSettings,
  })

  useEffect(() => {
    if (!session.sessionFailed) return
    showError(
      session.error ?? 'Koneksinya putus. Cek internet kamu terus muat ulang ya.',
    )
  }, [session.sessionFailed, session.error, showError])

  useEffect(() => {
    if (!session.unauthenticated) return
    showError('Kami belum kenal sesi kamu. Buka Tugas Duit dari Telegram dulu ya.')
  }, [session.unauthenticated, showError])

  const activeChallenge = session.view === 'captcha' ? session.activeChallenge : null
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
            onWithdraw={gateWithdrawReachable ? () => setGateWithdrawOpen(true) : null}
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
  )
}
