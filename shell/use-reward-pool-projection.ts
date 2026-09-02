'use client'

import { useEffect, useState } from 'react'
import { secondsUntil } from '@/domain/energy'
import {
  projectRewardPool,
  rewardPoolRegenMs,
  type RewardPoolState,
} from '@/domain/reward-pool'
import type { SessionRewardPool } from '@/shell/session-api'

/** Kembar dari `useEnergyProjection`: server mengirim satu potret, klien memajukannya sendiri supaya hitungan mundurnya berjalan tanpa polling. Begitu proyeksi melewati angka yang dikirim server, session di-refresh sekali supaya keduanya kembali sepakat. */
export function useRewardPoolProjection({
  payload,
  refreshSession,
}: {
  payload: SessionRewardPool | null
  refreshSession: () => void
}) {
  const clockOffset = payload === null ? 0 : payload.now - payload.receivedAt

  const snapshot =
    payload === null
      ? null
      : {
          credits: payload.current,
          updatedAt: payload.nextAt === null ? payload.now : payload.nextAt - rewardPoolRegenMs(),
        }

  const [clientNow, setClientNow] = useState(() => Date.now())
  const filling = payload !== null && payload.nextAt !== null
  useEffect(() => {
    if (!filling) return
    const timer = setInterval(() => setClientNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [filling])

  const now = clientNow + clockOffset
  const state: RewardPoolState | null =
    snapshot === null || payload === null ? null : projectRewardPool(snapshot, payload.max, now)

  const outgrewPayload = state !== null && payload !== null && state.current > payload.current
  useEffect(() => {
    if (outgrewPayload) refreshSession()
  }, [outgrewPayload, refreshSession])

  return {
    rewardPoolCredits: state?.current ?? null,
    rewardPoolMax: state?.max ?? null,
    rewardPoolRegenCredits: state?.regenCredits ?? null,
    rewardPoolSecondsToNext: secondsUntil(state?.nextAt ?? null, now),
  }
}
