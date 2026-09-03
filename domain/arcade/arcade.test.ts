import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMY_CONFIG,
  setActiveEconomyConfig,
  type EconomyConfig,
} from '../economy/economy-config'
import {
  arcadeCooldownSecondsLeft,
  arcadeOpenRefusal,
  arcadePlaysLeft,
  arcadePrizeTable,
  drawPrize,
  eligiblePrizes,
  hasWinnablePrize,
  type ArcadeHeadroom,
  type ArcadeOpenState,
} from './arcade'

const T0 = 1_700_000_000_000

/** Patch eksplisit menjaga tiap skenario ekonomi tetap terbaca, termasuk tes saklar yang mematikan Arena sementara meski bawaan produksi kini aktif. */
const on = (patch: Partial<EconomyConfig> = {}) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, arcadeEnabled: 1, ...patch })

const ROOMY: ArcadeHeadroom = { pool: 100, energy: 10 }

const openState = (patch: Partial<ArcadeOpenState> = {}): ArcadeOpenState => ({
  playsToday: 0,
  lastOpenedAt: null,
  hasOpenPlay: false,
  hasAdPass: true,
  headroom: ROOMY,
  ...patch,
})

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

describe('ARCADE-1 saklar panel', () => {
  it('menutup Arena saat admin mematikannya', () => {
    setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, arcadeEnabled: 0 })
    expect(arcadeOpenRefusal(openState(), T0)).toBe('arcade_disabled')
  })
})

describe('ARCADE-2 undian berbobot', () => {
  it('memetakan guliran ke hadiah sesuai porsi bobotnya, bukan sama rata', () => {
    on()
    const entries = arcadePrizeTable()
    // Bobot bawaan 1:2:1 atas total 4, jadi batasnya di 0,25 dan 0,75.
    expect(drawPrize(entries, 0).kind).toBe('pool')
    expect(drawPrize(entries, 0.249).kind).toBe('pool')
    expect(drawPrize(entries, 0.25).kind).toBe('energy')
    expect(drawPrize(entries, 0.749).kind).toBe('energy')
    expect(drawPrize(entries, 0.75).kind).toBe('blank')
  })

  it('menjepit guliran di luar rentang alih-alih jatuh ke zonk diam-diam', () => {
    on()
    const entries = arcadePrizeTable()
    expect(drawPrize(entries, -1).kind).toBe('pool')
    expect(drawPrize(entries, 1).kind).toBe('blank')
    expect(drawPrize(entries, 1.5).kind).toBe('blank')
  })

  it('mengembalikan zonk saat seluruh bobotnya nol, bukan melempar', () => {
    on({ arcadePoolPrizeWeight: 0, arcadeEnergyPrizeWeight: 0, arcadeBlankWeight: 0 })
    expect(drawPrize(arcadePrizeTable(), 0.5)).toEqual({ kind: 'blank', amount: 0 })
  })

  it('membawa besaran hadiah dari config, bukan dari angka di kode', () => {
    on({ arcadePoolPrizeCredits: 12, arcadeEnergyPrizeAmount: 3 })
    const entries = arcadePrizeTable()
    expect(drawPrize(entries, 0)).toEqual({ kind: 'pool', amount: 12 })
    expect(drawPrize(entries, 0.5)).toEqual({ kind: 'energy', amount: 3 })
  })
})

describe('ARCADE-3 hadiah yang tidak muat dicoret, bukan dipotong', () => {
  it('mencoret hadiah stok saat sisa kapasitas kurang dari besarannya', () => {
    on({ arcadePoolPrizeCredits: 5 })
    const kinds = eligiblePrizes({ pool: 4, energy: 10 }).map((entry) => entry.kind)
    expect(kinds).toEqual(['energy', 'blank'])
  })

  it('meloloskan hadiah stok saat sisanya pas, bukan hanya saat berlebih', () => {
    on({ arcadePoolPrizeCredits: 5 })
    const kinds = eligiblePrizes({ pool: 5, energy: 10 }).map((entry) => entry.kind)
    expect(kinds).toEqual(['pool', 'energy', 'blank'])
  })

  it('mencoret hadiah energi saat energi tinggal sedikit', () => {
    on({ arcadeEnergyPrizeAmount: 2 })
    const kinds = eligiblePrizes({ pool: 100, energy: 1 }).map((entry) => entry.kind)
    expect(kinds).toEqual(['pool', 'blank'])
  })

  it('mencoret hadiah yang bobotnya nol walau ruangnya cukup', () => {
    on({ arcadePoolPrizeWeight: 0 })
    const kinds = eligiblePrizes(ROOMY).map((entry) => entry.kind)
    expect(kinds).toEqual(['energy', 'blank'])
  })

  it('zonk tetap lolos walau stok dan energi sama-sama mentok', () => {
    on()
    expect(eligiblePrizes({ pool: 0, energy: 0 }).map((e) => e.kind)).toEqual(['blank'])
    expect(hasWinnablePrize({ pool: 0, energy: 0 })).toBe(false)
  })
})

describe('ARCADE-4 penolakan pembukaan main', () => {
  it('meloloskan keadaan normal', () => {
    on()
    expect(arcadeOpenRefusal(openState(), T0)).toBeNull()
  })

  it('menolak sebelum tiket iklan dibakar saat tidak ada satu pun hadiah yang bisa jatuh', () => {
    on()
    expect(arcadeOpenRefusal(openState({ headroom: { pool: 0, energy: 0 } }), T0)).toBe(
      'nothing_to_win',
    )
  })

  it('mendahulukan ronde yang belum ditutup daripada jeda, karena obatnya berbeda', () => {
    on()
    const state = openState({ hasOpenPlay: true, lastOpenedAt: T0 })
    expect(arcadeOpenRefusal(state, T0)).toBe('play_open')
  })

  it('menolak saat jatah harian habis', () => {
    on({ arcadeMaxPlaysPerDay: 2 })
    expect(arcadeOpenRefusal(openState({ playsToday: 2 }), T0)).toBe('daily_cap')
    expect(arcadePlaysLeft(2)).toBe(0)
    expect(arcadePlaysLeft(99)).toBe(0)
  })

  it('menolak selama jeda antar main belum lewat', () => {
    on({ arcadeCooldownSeconds: 300 })
    expect(arcadeOpenRefusal(openState({ lastOpenedAt: T0 - 299_000 }), T0)).toBe('cooldown')
    expect(arcadeOpenRefusal(openState({ lastOpenedAt: T0 - 300_000 }), T0)).toBeNull()
  })

  it('menuntut pass iklan hanya selama kuncinya menyala', () => {
    on()
    expect(arcadeOpenRefusal(openState({ hasAdPass: false }), T0)).toBe('no_ad_pass')
    on({ arcadeAdGated: 0 })
    expect(arcadeOpenRefusal(openState({ hasAdPass: false }), T0)).toBeNull()
  })
})

describe('ARCADE-5 hitung mundur jeda', () => {
  it('tidak pernah negatif dan nol saat belum pernah main', () => {
    on({ arcadeCooldownSeconds: 120 })
    expect(arcadeCooldownSecondsLeft(null, T0)).toBe(0)
    expect(arcadeCooldownSecondsLeft(T0 - 60_000, T0)).toBe(60)
    expect(arcadeCooldownSecondsLeft(T0 - 999_000, T0)).toBe(0)
  })
})
