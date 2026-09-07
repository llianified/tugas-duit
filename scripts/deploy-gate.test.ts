import { describe, expect, it } from 'vitest'
import { deployDecision } from './deploy-gate.ts'

/** MIGR-1 — penjaga migrasi otomatis.
 *
 * Yang dijaga di sini bukan kenyamanan, melainkan satu invarian: migrasi otomatis TIDAK PERNAH
 * dilewati tanpa suara. Platform atau sinyal preview yang tidak jelas harus menggagalkan build,
 * bukan membiarkan kode live di atas skema lama. */
describe('MIGR-1 — migrasi otomatis hanya jalan untuk deploy produksi', () => {
  it('jalan di service Render yang bukan preview', () => {
    expect(deployDecision({ RENDER: 'true', IS_PULL_REQUEST: 'false' })).toEqual({
      action: 'run',
      platform: 'Render',
    })
  })

  it('melewati preview pull request Render', () => {
    const decision = deployDecision({ RENDER: 'true', IS_PULL_REQUEST: 'true' })
    expect(decision.action).toBe('skip')
  })

  it('MENGGAGALKAN build saat platformnya tidak dikenal, bukan melewatinya diam-diam', () => {
    const decision = deployDecision({})
    expect(decision.action).toBe('fail')
    if (decision.action === 'fail') expect(decision.reason).toMatch(/tidak dikenal/i)
  })

  it('MENGGAGALKAN build saat Render terbaca tapi sinyal preview-nya tidak', () => {
    for (const env of [{ RENDER: 'true' }, { RENDER: 'true', IS_PULL_REQUEST: '' }]) {
      const decision = deployDecision(env)
      expect(decision.action).toBe('fail')
      if (decision.action === 'fail') expect(decision.reason).toMatch(/IS_PULL_REQUEST/)
    }
  })

  /** Env produksi Render yang lengkap tidak boleh ikut tergagalkan oleh penjaga di atas. */
  it('tidak menggagalkan Render hanya karena env lain ikut terisi', () => {
    expect(
      deployDecision({ RENDER: 'true', IS_PULL_REQUEST: 'false', NODE_ENV: 'production' }).action,
    ).toBe('run')
  })
})
