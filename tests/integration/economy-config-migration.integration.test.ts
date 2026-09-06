import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validateEconomyConfig } from '@/domain/economy/economy-config'

/** Migrasi 0056 adalah separuh dari satu perbaikan; separuh lainnya aturan kelipatan di
 * `validateEconomyConfig`. Keduanya harus diuji bersama karena yang berbahaya justru urutannya:
 * `parseRow` memvalidasi ulang baris yang SUDAH tersimpan pada setiap `loadEconomyConfig`, jadi
 * aturan baru yang mendarat di atas baris lama yang belum dinormalkan akan membuat seluruh API
 * menjawab `ECONOMY_CONFIG_INVALID`. Yang diuji di sini: sesudah migrasinya jalan, baris yang
 * paling buruk sekalipun lolos aturan itu. */

const ROOT = path.resolve(import.meta.dirname, '../..')
const MIGRATION = 'db/migrations/0056_premium_commission_cap_multiple.sql'

let migrationSql: string
let original: unknown

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../../server/platform/db')
  await query('select 1')
  migrationSql = await readFile(path.join(ROOT, MIGRATION), 'utf8')
  original = (await query<{ config: unknown }>('select config from economy_config where id=1'))[0]
    ?.config
}, 120_000)

/** Barisnya global untuk seluruh suite. Berkas uji jalan berurutan (`fileParallelism: false`),
 * jadi memulihkannya di sini sudah cukup — tanpa itu berkas berikutnya membaca konfigurasi yang
 * sengaja dirusak di sini. */
afterAll(async () => {
  if (original === undefined) return
  const { query } = await import('../../server/platform/db')
  await query('update economy_config set config=$1::jsonb where id=1', [
    JSON.stringify(original),
  ])
})

async function storedCap(): Promise<{ premium: number; base: number; rate: number }> {
  const { query } = await import('../../server/platform/db')
  const rows = await query<{ premium: string; base: string; rate: string }>(
    `select config ->> 'premiumDailyCommissionCapIdr' as premium,
            config ->> 'dailyCommissionCapIdr'        as base,
            config ->> 'creditValueIdr'               as rate
       from economy_config where id=1`,
  )
  return {
    premium: Number(rows[0].premium),
    base: Number(rows[0].base),
    rate: Number(rows[0].rate),
  }
}

async function setPremiumCap(value: number): Promise<void> {
  const { query } = await import('../../server/platform/db')
  await query(
    `update economy_config
        set config = config || jsonb_build_object('premiumDailyCommissionCapIdr', $1::int)
      where id = 1`,
    [value],
  )
}

describe('AUDIT-2 — plafon komisi premium selalu kelipatan kurs', () => {
  it('membulatkan ke bawah nilai lama yang bukan kelipatan', async () => {
    const { query } = await import('../../server/platform/db')
    await setPremiumCap(12_050)

    await query(migrationSql)

    const after = await storedCap()
    expect(after.premium % after.rate).toBe(0)
    /** Ke BAWAH, bukan ke atas: plafon komisi adalah batas atas liabilitas harian, dan migrasi
     * tidak boleh diam-diam menaikkan biaya. */
    expect(after.premium).toBe(12_000)
  })

  it('tidak pernah menjatuhkannya di bawah plafon non-premium', async () => {
    const { query } = await import('../../server/platform/db')
    const before = await storedCap()
    await setPremiumCap(before.base + 1)

    await query(migrationSql)

    const after = await storedCap()
    expect(after.premium).toBeGreaterThanOrEqual(after.base)
    expect(after.premium % after.rate).toBe(0)
  })

  it('membiarkan nilai yang sudah kelipatan apa adanya', async () => {
    const { query } = await import('../../server/platform/db')
    await setPremiumCap(15_000)

    await query(migrationSql)

    expect((await storedCap()).premium).toBe(15_000)
  })

  /** Inti keseluruhannya: baris hasil migrasi lolos aturan yang baru, jadi `loadEconomyConfig`
   * tidak pernah menjatuhkan seluruh API sesudah deploy.
   *
   * Yang diuji hanya nilai yang benar-benar bisa tersimpan, yaitu yang tidak lebih kecil daripada
   * plafon non-premium — aturan itu sudah ditegakkan `validateEconomyConfig` jauh sebelum migrasi
   * ini, jadi baris di bawahnya tidak pernah bisa lolos panel. Memasukkannya ke sini hanya akan
   * menuntut migrasi memperbaiki keadaan yang tidak pernah ada. */
  it('meninggalkan baris yang lolos validasi untuk setiap nilai yang bisa tersimpan', async () => {
    const { query } = await import('../../server/platform/db')
    const { base } = await storedCap()

    for (const value of [base + 50, 12_001, 12_050, 12_099, 999_999]) {
      expect(value).toBeGreaterThanOrEqual(base)
      await setPremiumCap(value)
      await query(migrationSql)

      const rows = await query<{ config: unknown }>('select config from economy_config where id=1')
      const parsed = validateEconomyConfig(rows[0].config, { fillMissing: true })
      expect(parsed.ok, `nilai lama ${value} menyisakan baris yang ditolak validasi`).toBe(true)
    }
  })
})
