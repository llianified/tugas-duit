import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig } from '@/domain/economy/economy-config'
import { withdrawalCooldownMs } from '@/domain/economy/premium'
import {
  requiredActiveDays,
  requiredActiveReferrals,
  withdrawalCooldownMsForBase,
} from './payout-rules'

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

describe('aturan kelayakan payout', () => {
  it('membaca syarat referral saat fungsi dipanggil, bukan ketika modul dimuat', () => {
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, withdrawalMinActiveReferrals: 2 })
    expect(requiredActiveReferrals()).toBe(2)

    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, withdrawalMinActiveReferrals: 6 })
    expect(requiredActiveReferrals()).toBe(6)
  })

  it('membaca syarat hari aktif dari konfigurasi terbaru', () => {
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, withdrawalMinActiveDays: 4 })
    expect(requiredActiveDays()).toBe(4)
  })

  it('menggunakan cooldown non-premium sebagai aturan dasar', () => {
    expect(withdrawalCooldownMsForBase()).toBe(withdrawalCooldownMs(false))
    expect(withdrawalCooldownMsForBase()).toBeGreaterThan(0)
  })
})
