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

describe('RL-3 — reservasi token menekan jumlah write tanpa melonggarkan plafon', () => {
  /** Yang diukur di sini bukan jumlah pemanggilan fungsi, tapi jumlah **write** ke Postgres — dan itu bisa dibaca langsung dari database tanpa memalsukan apa pun: satu reservasi menaikkan `count` sebesar ukuran lease-nya, jadi `count` akhir dibagi ukuran lease sama dengan banyaknya pernyataan yang benar-benar dijalankan. Tanpa reservasi, 200 pemanggilan berarti 200 write; itu yang dulu membuat akuntansi rate limit sendiri jadi penyumbang write terbesar di database. */
  const sumCount = async (bucket: string) => {
    const { query } = await import('./db')
    const rows = await query<{ total: string | null }>(
      'select sum(count)::bigint as total from rate_limits where bucket=$1',
      [bucket],
    )
    return Number(rows[0]?.total ?? 0)
  }

  it('meloloskan tepat sebanyak plafonnya dengan write jauh lebih sedikit', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const bucket = uniqueBucket()

    let diloloskan = 0
    for (let i = 0; i < 200; i++) {
      if ((await checkRateLimit(bucket, 200, 3_600)).allowed) diloloskan++
    }

    expect(diloloskan).toBe(200)
    /** 200 token / lease 10 = 20 reservasi, jadi total `count` tidak boleh lebih dari 21 write × 10 token. Batas atas, bukan angka pas, supaya pergantian window di tengah uji tidak membuatnya rapuh. Plafonnya sendiri tidak naik sedikit pun — itu yang dijaga `diloloskan` di atas. */
    expect(await sumCount(bucket)).toBeLessThanOrEqual(210)

    expect((await checkRateLimit(bucket, 200, 3_600)).allowed).toBe(false)
  })

  it('tidak menulis apa pun lagi setelah bucket-nya tertolak', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const bucket = uniqueBucket()

    for (let i = 0; i < 201; i++) await checkRateLimit(bucket, 200, 3_600)
    const setelahTertolak = await sumCount(bucket)

    for (let i = 0; i < 50; i++) {
      expect((await checkRateLimit(bucket, 200, 3_600)).allowed).toBe(false)
    }

    /** Lubang yang paling mahal di versi sebelumnya: request yang dijawab 429 tetap membayar satu write, jadi penyalahgunaan paling kasar justru yang paling membebani database. */
    expect(await sumCount(bucket)).toBe(setelahTertolak)
  })

  it('tidak pernah meloloskan lebih dari plafon meski request datang berbarengan', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const bucket = uniqueBucket()

    const hasil = await Promise.all(
      Array.from({ length: 150 }, () => checkRateLimit(bucket, 100, 3_600)),
    )

    expect(hasil.filter((satu) => satu.allowed).length).toBeLessThanOrEqual(100)
    expect(hasil.some((satu) => !satu.allowed)).toBe(true)
  })

  it('menghitung bucket kecil secara eksak, tanpa reservasi', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const bucket = uniqueBucket()

    /** `withdraw` 5/jam, `premium:checkout` 10/600s, `admin:maintenance` 6/jam, `task:submit` 30/60s — semuanya di bawah ambang lease, jadi hitungannya tetap satu write satu request. Kalau ambangnya digeser, test ini yang gagal lebih dulu. */
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit(bucket, 5, 3_600)).allowed).toBe(true)
    }
    expect((await checkRateLimit(bucket, 5, 3_600)).allowed).toBe(false)
    expect(await sumCount(bucket)).toBe(6)
  })

  it('memberi retryAfter yang masih di dalam window', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const bucket = uniqueBucket()

    await checkRateLimit(bucket, 1, 600)
    const tertolak = await checkRateLimit(bucket, 1, 600)

    expect(tertolak.allowed).toBe(false)
    expect(tertolak.retryAfter).toBeGreaterThan(0)
    expect(tertolak.retryAfter).toBeLessThanOrEqual(600)
  })
})

describe('RL-2 — setiap route bersesi wajib punya rate limit', () => {
  /** `GET /api/withdrawals` sempat jadi satu-satunya baca milik user tanpa plafon, padahal ia yang paling berat — dan seluruh permukaan admin yang sudah terautentikasi juga kosong. Keduanya tidak terlihat saat membaca satu berkas; yang menemukannya justru membandingkan semua route sekaligus. Test ini melakukan perbandingan itu setiap kali. Aturannya: kalau sebuah route memakai sesi (`requireUser`/`requireAdmin`), ia harus memanggil `checkRateLimit`. Webhook dan probe tidak bersesi, jadi terkecualikan dengan sendirinya tanpa perlu daftar pengecualian yang harus dirawat. */
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
