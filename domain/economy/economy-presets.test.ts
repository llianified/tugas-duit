import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG, ECONOMY_FIELDS, validateEconomyConfig } from '@/domain/economy/economy-config'
import { ECONOMY_PRESETS, parseEconomyPatch } from '@/domain/economy/economy-presets'

describe('ECONOMY_PRESETS', () => {
  for (const preset of ECONOMY_PRESETS) {
    it(`${preset.id} hanya memakai key yang dikenal`, () => {
      const known = new Set<string>(ECONOMY_FIELDS.map((field) => field.key))
      for (const key of Object.keys(preset.values)) expect(known.has(key)).toBe(true)
    })

    it(`${preset.id} lolos validasi setelah digabung ke config aktif`, () => {
      const result = validateEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...preset.values })
      expect(result.ok ? null : result.errors).toBeNull()
    })
  }
})

describe('parseEconomyPatch', () => {
  it('menerima JSON sebagian', () => {
    const result = parseEconomyPatch('{"rewardPoolCapIdr": 10000}')
    expect(result).toEqual({ ok: true, patch: { rewardPoolCapIdr: 10_000 }, unknownKeys: [] })
  })

  it('membuka pembungkus config dan melaporkan key tak dikenal', () => {
    const result = parseEconomyPatch('{"config":{"maxEnergy":6,"nope":1}}')
    expect(result).toEqual({ ok: true, patch: { maxEnergy: 6 }, unknownKeys: ['nope'] })
  })

  it('mengubah angka berbentuk string', () => {
    const result = parseEconomyPatch('{"maxEnergy":"6"}')
    expect(result).toEqual({ ok: true, patch: { maxEnergy: 6 }, unknownKeys: [] })
  })

  it('menolak JSON rusak, nilai bukan angka, dan objek tanpa key dikenal', () => {
    expect(parseEconomyPatch('{oops').ok).toBe(false)
    expect(parseEconomyPatch('{"maxEnergy":"banyak"}').ok).toBe(false)
    expect(parseEconomyPatch('{"nope":1}').ok).toBe(false)
    expect(parseEconomyPatch('   ').ok).toBe(false)
  })
})
