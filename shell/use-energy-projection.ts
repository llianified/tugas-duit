'use client'

import { useEffect, useState } from 'react'
import {
  energyRegenMs,
  projectEnergy,
  secondsUntil,
  type EnergyState,
} from '@/domain/energy'
import type { SessionEnergy } from '@/shell/session-api'

export function useEnergyProjection({
  payload,
  refreshSession,
}: {
  payload: SessionEnergy | null
  refreshSession: () => void
}) {
  const clockOffset = payload === null ? 0 : payload.now - payload.receivedAt

  const snapshot =
    payload === null
      ? null
      : {
          energy: payload.current,
          updatedAt: payload.nextAt === null ? payload.now : payload.nextAt - energyRegenMs(),
        }

  const [clientNow, setClientNow] = useState(() => Date.now())
  const energyFilling = payload !== null && payload.nextAt !== null
  useEffect(() => {
    if (!energyFilling) return
    const timer = setInterval(() => setClientNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [energyFilling])

  const energyState: EnergyState | null =
    snapshot === null ? null : projectEnergy(snapshot, clientNow + clockOffset)

  const energyOutgrewPayload =
    energyState !== null && payload !== null && energyState.current > payload.current
  useEffect(() => {
    if (energyOutgrewPayload) refreshSession()
  }, [energyOutgrewPayload, refreshSession])

  return {
    energy: energyState?.current ?? 0,
    energySecondsToNext: secondsUntil(energyState?.nextAt ?? null, clientNow + clockOffset),
  }
}
