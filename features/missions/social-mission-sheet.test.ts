import { describe, expect, it } from 'vitest'
import { secondsUntilConfirmation } from './social-mission-sheet'

describe('countdown konfirmasi misi sosial', () => {
  it('mengabaikan selisih absolut jam perangkat dan memakai waktu server sebagai jangkar', () => {
    const timing = {
      serverNow: 1_000_000,
      confirmAt: 1_030_000,
      receivedAt: 20_000_000,
    }

    expect(secondsUntilConfirmation(timing, 20_005_000)).toBe(25)
  })

  it('berhenti di nol setelah waktu konfirmasi server terlewati', () => {
    const timing = {
      serverNow: 1_000_000,
      confirmAt: 1_010_000,
      receivedAt: 20_000_000,
    }

    expect(secondsUntilConfirmation(timing, 20_015_000)).toBe(0)
  })
})
