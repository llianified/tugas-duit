import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

const uniqueBucket = () => `uji-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

describe('RL-1 — penghitung jendela', () => {
  it('meloloskan tepat sebanyak plafonnya lalu menolak', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const bucket = uniqueBucket()

    expect((await checkRateLimit(bucket, 2, 3_600)).allowed).toBe(true)
    expect((await checkRateLimit(bucket, 2, 3_600)).allowed).toBe(true)
    expect((await checkRateLimit(bucket, 2, 3_600)).allowed).toBe(false)
  })

  it('memisahkan hitungan antar bucket', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const satu = uniqueBucket()
    const dua = uniqueBucket()

    await checkRateLimit(satu, 1, 3_600)
    expect((await checkRateLimit(satu, 1, 3_600)).allowed).toBe(false)
    expect((await checkRateLimit(dua, 1, 3_600)).allowed).toBe(true)
  })

  it('peek tidak ikut menaikkan hitungan', async () => {
    const { checkRateLimit, peekRateLimit } = await import('./ratelimit')
    const bucket = uniqueBucket()

    await checkRateLimit(bucket, 2, 3_600)
    expect((await peekRateLimit(bucket, 2, 3_600)).allowed).toBe(true)
    expect((await peekRateLimit(bucket, 2, 3_600)).allowed).toBe(true)
    expect((await checkRateLimit(bucket, 2, 3_600)).allowed).toBe(true)
    expect((await checkRateLimit(bucket, 2, 3_600)).allowed).toBe(false)
  })
})

describe('RL-2 — setiap route bersesi wajib punya rate limit', () => {
  /**
   * `GET /api/withdrawals` sempat jadi satu-satunya baca milik user tanpa plafon, padahal
   * ia yang paling berat — dan seluruh permukaan admin yang sudah terautentikasi juga
   * kosong. Keduanya tidak terlihat saat membaca satu berkas; yang menemukannya justru
   * membandingkan semua route sekaligus. Test ini melakukan perbandingan itu setiap kali.
   *
   * Aturannya: kalau sebuah route memakai sesi (`requireUser`/`requireAdmin`), ia harus
   * memanggil `checkRateLimit`. Webhook dan probe tidak bersesi, jadi terkecualikan
   * dengan sendirinya tanpa perlu daftar pengecualian yang harus dirawat.
   */
  it('tidak menyisakan route bersesi yang tanpa plafon', async () => {
    const root = path.join(process.cwd(), 'app/api')
    const entries = await readdir(root, { recursive: true })
    const routes = entries.filter((entry) => entry.endsWith('route.ts')).sort()

    expect(routes.length).toBeGreaterThan(20)

    const tanpaPlafon: string[] = []
    for (const relative of routes) {
      const source = await readFile(path.join(root, relative), 'utf8')
      const bersesi = source.includes('requireUser') || source.includes('requireAdmin')
      if (bersesi && !source.includes('checkRateLimit')) tanpaPlafon.push(relative)
    }

    expect(tanpaPlafon).toEqual([])
  })
})
