import { afterEach, describe, expect, it } from 'vitest'
import {
  GIGAPUB_PROJECT_ID,
  adCooldownSecondsLeft,
  adOpenRefusal,
  adViewsLeft,
  adsConfigured,
} from './ads'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig, type EconomyConfig } from '../economy/economy-config'

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

const withConfig = (patch: Partial<EconomyConfig>) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

const NOW = 1_700_000_000_000

const state = (patch: Partial<Parameters<typeof adOpenRefusal>[0]> = {}) => ({
  viewsToday: 0,
  lastOpenedAt: null,
  hasPending: false,
  hasReady: false,
  hasEntryOpen: false,
  ...patch,
})

describe('ADS-0 — konfigurasi provider rewarded', () => {
  it('memakai project Giga.pub yang disetujui', () => {
    expect(GIGAPUB_PROJECT_ID).toBe('7799')
  })
})

describe('ADS-1 — adsMaxViewsPerDay 0 adalah tombol mati', () => {
  it('menolak membuka tiket tanpa melihat keadaan lain', () => {
    withConfig({ adsMaxViewsPerDay: 0 })
    expect(adsConfigured()).toBe(false)
    expect(adOpenRefusal(state(), NOW)).toBe('ads_disabled')
  })

  it('menyala lagi begitu plafonnya dinaikkan', () => {
    withConfig({ adsMaxViewsPerDay: 1 })
    expect(adOpenRefusal(state(), NOW)).toBeNull()
  })
})

describe('ADS-2 — plafon harian dan cooldown', () => {
  it('menghitung sisa tayangan dari plafon aktif', () => {
    withConfig({ adsMaxViewsPerDay: 4 })
    expect(adViewsLeft(0)).toBe(4)
    expect(adViewsLeft(3)).toBe(1)
    expect(adViewsLeft(9)).toBe(0)
  })

  it('menolak saat plafon harian habis', () => {
    withConfig({ adsMaxViewsPerDay: 2 })
    expect(adOpenRefusal(state({ viewsToday: 2 }), NOW)).toBe('daily_limit')
  })

  it('menolak selama cooldown belum lewat, lalu melepas', () => {
    withConfig({ adsCooldownSeconds: 120 })
    expect(adOpenRefusal(state({ lastOpenedAt: NOW - 60_000 }), NOW)).toBe('cooling_down')
    expect(adCooldownSecondsLeft(NOW - 60_000, NOW)).toBe(60)
    expect(adOpenRefusal(state({ lastOpenedAt: NOW - 120_000 }), NOW)).toBeNull()
    expect(adCooldownSecondsLeft(NOW - 120_000, NOW)).toBe(0)
  })
})

describe('ADS-3 — stok tidak boleh menumpuk', () => {
  it('menolak tiket baru selama masih ada tiket menganggur', () => {
    expect(adOpenRefusal(state({ hasPending: true }), NOW)).toBe('ticket_open')
  })

  it('menolak tiket baru selama pass yang siap belum dipakai', () => {
    expect(adOpenRefusal(state({ hasReady: true }), NOW)).toBe('pass_ready')
  })

  it('menolak tiket baru selama task yang dibayar tiket masih berjalan', () => {
    expect(adOpenRefusal(state({ hasEntryOpen: true }), NOW)).toBe('entry_open')
  })

  it('mendahulukan task berjalan daripada tiket menganggur', () => {
    expect(adOpenRefusal(state({ hasEntryOpen: true, hasPending: true }), NOW)).toBe('entry_open')
  })
})
