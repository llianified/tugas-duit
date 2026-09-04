'use client'

import { useEffect, useState } from 'react'
import {
  energyFill,
  energyRegenMs,
  projectEnergy,
  secondsUntil,
  type EnergyFill,
  type EnergyState,
} from '@/domain/economy/energy'
import type { SessionEnergy } from '@/shell/session-api'

const FULL: EnergyFill = { secondsToFull: null, fraction: 1 }

export function useEnergyProjection({
  payload,
  premium,
  refreshSession,
}: {
  payload: SessionEnergy | null
  premium: boolean
  refreshSession: () => void
}) {
  const clockOffset = payload === null ? 0 : payload.now - payload.receivedAt

  const snapshot =
    payload === null
      ? null
      : {
          energy: payload.current,
          updatedAt: payload.nextAt === null ? payload.now : payload.nextAt - energyRegenMs(premium),
        }

  const [clientNow, setClientNow] = useState(() => Date.now())
  const energyFilling = payload !== null && payload.nextAt !== null
  useEffect(() => {
    if (!energyFilling) return
    const timer = setInterval(() => setClientNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [energyFilling])

  const now = clientNow + clockOffset
  const energyState: EnergyState | null =
    snapshot === null ? null : projectEnergy(snapshot, now, premium)

  const energyOutgrewPayload =
    energyState !== null && payload !== null && energyState.current > payload.current
  useEffect(() => {
    if (energyOutgrewPayload) refreshSession()
  }, [energyOutgrewPayload, refreshSession])

  return {
    energy: energyState?.current ?? 0,
    energySecondsToNext: secondsUntil(energyState?.nextAt ?? null, now),
    energyFill: energyState === null ? FULL : energyFill(energyState, now, premium),
  }
}
