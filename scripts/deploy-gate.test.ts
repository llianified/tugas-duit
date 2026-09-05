import { describe, expect, it } from 'vitest'
import { deployDecision } from './deploy-gate.ts'

/** MIGR-1 — penjaga migrasi otomatis.
 *
 * Yang dijaga di sini bukan kenyamanan, melainkan satu invarian: migrasi otomatis TIDAK PERNAH
 * dilewati tanpa suara. Bentuk lamanya memeriksa `VERCEL_ENV` saja dan keluar dengan status 0 di
 * platform lain — build hijau, deploy hijau, skema tertinggal, dan tidak ada yang tahu sampai ada
 * user yang layarnya error. */
describe('MIGR-1 — migrasi otomatis hanya jalan untuk deploy produksi', () => {
  it('jalan di Production Vercel', () => {
    expect(deployDecision({ VERCEL: '1', VERCEL_ENV: 'production' })).toEqual({
      action: 'run',
      platform: 'Vercel',
    })
  })

  it.each(['preview', 'development', undefined])(
    'melewati deploy Vercel yang VERCEL_ENV-nya %s',
    (vercelEnv) => {
      const decision = deployDecision({ VERCEL: '1', VERCEL_ENV: vercelEnv })
      expect(decision.action).toBe('skip')
    },
  )

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

  /** Inti perbaikannya. Ketiga keadaan di bawah dulu berakhir sama: keluar 0, melaporkan sukses,
   * tidak memigrasi apa pun. Sekarang ketiganya menggagalkan build. */
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

  /** Vercel diperiksa lebih dulu: selama masih ada di sana, penambahan Render tidak boleh
   * mengubah perilaku deploy yang sedang melayani user. */
  it('mendahulukan Vercel saat keduanya terbaca', () => {
    expect(
      deployDecision({ VERCEL: '1', VERCEL_ENV: 'production', RENDER: 'true' }),
    ).toEqual({ action: 'run', platform: 'Vercel' })
  })
})
