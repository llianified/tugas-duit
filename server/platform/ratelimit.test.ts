import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

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

  it('tidak melipatgandakan write di ekor window', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const bucket = uniqueBucket()

    /** Window 2 detik: sisa window **selalu** ≤ `LEASE_GUARD_MS`, jadi setiap request di sini adalah request "ekor window" tanpa perlu memalsukan jam sama sekali. Plafonnya 60 supaya jalur lease aktif — di bawah 60 jalur eksak memang sudah dipakai dan uji ini jadi tidak membuktikan apa pun.
     *
     * Sebelum diperbaiki, request seperti ini memesan lease yang langsung kena guard-nya sendiri, gagal mengambil token, lalu memesan lagi sampai `MAX_ACQUIRE_ATTEMPTS` habis dan baru jatuh ke jalur eksak: 9 write untuk satu request, dan ~80 token terbakar tanpa pernah dipakai — cukup untuk memicu 429 palsu di ujung window pada bucket seperti `premium:webhook` 120/60s dan `task:issue` 60/60s. Sekarang satu request = satu write, dan tidak ada token yang hangus. */
    const panggilan = 12
    for (let i = 0; i < panggilan; i++) {
      expect((await checkRateLimit(bucket, 60, 2)).allowed).toBe(true)
    }

    expect(await sumCount(bucket)).toBe(panggilan)
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

describe('RL-4 — plafon efektif saat lease tersebar ke beberapa instance', () => {
  /** Lease disimpan di memori modul, jadi "proses kedua" berarti salinan modul kedua: `resetModules()` membuat `import` berikutnya mengevaluasi ulang `ratelimit.ts` dengan `Map` lease yang benar-benar baru. Databasenya tetap satu — PGlite di-cache di `globalThis` (`preview-db.ts`), jadi ia lolos dari reset dan kedua salinan menulis ke tabel `rate_limits` yang sama, persis seperti dua proses aplikasi yang berbagi satu Postgres. */
  const instanceBaru = async () => {
    vi.resetModules()
    return import('./ratelimit')
  }

  it('tidak pernah melewati plafon meski dua instance melayani bucket yang sama', async () => {
    const satu = await instanceBaru()
    const dua = await instanceBaru()
    const bucket = uniqueBucket()

    let diloloskan = 0
    for (let i = 0; i < 300; i++) {
      const instance = i % 2 === 0 ? satu : dua
      if ((await instance.checkRateLimit(bucket, 200, 3_600)).allowed) diloloskan++
    }

    /** Yang wajib: plafon tidak pernah naik walau lease-nya terpisah. Kedua instance sama-sama menghabiskan lease-nya di sini, jadi tidak ada token yang hangus dan angkanya harus menempel di plafon. */
    expect(diloloskan).toBeLessThanOrEqual(200)
    expect(diloloskan).toBe(200)
  })

  it('menyusut paling banyak sebesar lease yang ditinggalkan instance menganggur', async () => {
    const instances = [await instanceBaru(), await instanceBaru(), await instanceBaru()]
    const bucket = uniqueBucket()
    const limit = 300
    const leaseSize = 10

    /** Kasus terburuk yang bisa dibuat: tiap instance memesan satu lease penuh lalu berhenti melayani bucket ini — token sisanya tidak akan pernah terpakai. Ini yang terjadi saat lalu lintas satu admin berpindah instance, atau instance-nya dimatikan di tengah window. */
    for (const instance of instances) {
      expect((await instance.checkRateLimit(bucket, limit, 3_600)).allowed).toBe(true)
    }

    /** Lalu satu instance menghabiskan sisa plafon sampai tertolak. */
    let diloloskan = instances.length
    for (let i = 0; i < limit * 2; i++) {
      if (!(await instances[0].checkRateLimit(bucket, limit, 3_600)).allowed) break
      diloloskan++
    }

    /** Toleransi yang diterima, dan alasannya: setiap instance menganggur menghanguskan paling banyak `leaseSize - 1` token, dan instance yang masih melayani tetap memakai sisa lease-nya sendiri. Jadi kerugian maksimum satu window adalah `(instance - 1) × (leaseSize - 1)` = 18 dari 300, alias plafon efektif ≥ 94%. Kalau `LEASE_MAX` atau `LEASE_DIVISOR` digeser sampai toleransi ini terlampaui, test inilah yang gagal lebih dulu — bukan produksi. */
    const kerugianMaksimum = (instances.length - 1) * (leaseSize - 1)
    expect(diloloskan).toBeLessThanOrEqual(limit)
    expect(diloloskan).toBeGreaterThanOrEqual(limit - kerugianMaksimum)
    expect(diloloskan / limit).toBeGreaterThanOrEqual(0.94)
  })

  it('menjaga plafon bucket kecil tetap eksak lintas instance', async () => {
    const satu = await instanceBaru()
    const dua = await instanceBaru()
    const bucket = uniqueBucket()

    /** Bucket yang menuntut plafon eksak harus berada di bawah `LEASE_MIN_LIMIT`, dan semuanya memang di sana: `withdraw` 5/jam, `admin:maintenance` 6/jam, `premium:checkout` 10/600s, `task:submit` 30/60s. Tanpa lease tidak ada fragmentasi, jadi plafon efektifnya sama dengan plafon nominal berapa pun jumlah instance-nya. */
    let diloloskan = 0
    for (let i = 0; i < 12; i++) {
      const instance = i % 2 === 0 ? satu : dua
      if ((await instance.checkRateLimit(bucket, 6, 3_600)).allowed) diloloskan++
    }

    expect(diloloskan).toBe(6)
  })
})

describe('RL-2 — setiap route bersesi wajib punya rate limit', () => {
  /** `GET /api/withdrawals` sempat jadi satu-satunya baca milik user tanpa plafon, padahal ia yang paling berat — dan seluruh permukaan admin yang sudah terautentikasi juga kosong. Keduanya tidak terlihat saat membaca satu berkas; yang menemukannya justru membandingkan semua route sekaligus. Test ini melakukan perbandingan itu setiap kali. Aturannya: kalau sebuah route memakai sesi (`requireUser`/`requireAdmin`), ia harus memanggil `checkRateLimit`. Webhook dan probe tidak bersesi, jadi terkecualikan dengan sendirinya tanpa perlu daftar pengecualian yang harus dirawat. */
  it('tidak menyisakan route bersesi yang tanpa plafon', async () => {
    // `app/(admin)` ikut disapu meski hari ini tidak berisi satu pun route handler: panel admin
    // punya root layout dan CSP sendiri, dan route yang lahir di sana tidak boleh diam-diam
    // berada di luar jangkauan aturan ini.
    const roots = ['app/api', 'app/(admin)'].map((relative) => path.join(process.cwd(), relative))

    const routes: { root: string; relative: string }[] = []
    for (const root of roots) {
      const entries = await readdir(root, { recursive: true })
      for (const entry of entries.filter((name) => name.endsWith('route.ts')).sort()) {
        routes.push({ root, relative: entry })
      }
    }

    expect(routes.length).toBeGreaterThan(20)

    const tanpaPlafon: string[] = []
    for (const { root, relative } of routes) {
      const source = await readFile(path.join(root, relative), 'utf8')
      const bersesi = source.includes('requireUser') || source.includes('requireAdmin')
      if (bersesi && !source.includes('checkRateLimit')) tanpaPlafon.push(relative)
    }

    expect(tanpaPlafon).toEqual([])
  })
})

describe('RL-5 — setiap pembacaan panel admin wajib lewat requireAdminRead', () => {
  /** RL-2 hanya melihat `app/api`, dan itu memang seluruh permukaan yang dilihatnya — panel admin adalah React Server Component, jadi `router.refresh()` memukul endpoint RSC dan memanggil fungsi datanya langsung tanpa melewati satu pun route handler. Plafonnya karena itu harus duduk di fungsi datanya, bukan di halamannya. Aturannya: fungsi baca (`read*`, `search*`, `get*`, `list*`) yang menjaga dirinya dengan sesi admin harus memakai `requireAdminRead()`, bukan `requireAdmin()` polos. Jalur tulis tidak ikut — plafonnya sudah ada di route API-nya. */
  const BERKAS_BACA_ADMIN = [
    'server/admin/admin-stats.ts',
    'server/admin/admin-ops.ts',
    'server/admin/admin-users.ts',
    'server/admin/admin-grants.ts',
    'server/payout/payout.ts',
    'server/economy/economy-config.ts',
    'server/messaging/broadcast.ts',
  ]

  it('tidak menyisakan fungsi baca admin yang memakai requireAdmin polos', async () => {
    const tanpaPlafon: string[] = []

    for (const relative of BERKAS_BACA_ADMIN) {
      const source = await readFile(path.join(process.cwd(), relative), 'utf8')
      for (const chunk of source.split(/(?=export async function )/)) {
        const nama = /^export async function (\w+)/.exec(chunk)?.[1]
        if (!nama || !/^(read|search|get|list)/.test(nama)) continue
        if (/requireAdmin\(\)/.test(chunk)) tanpaPlafon.push(`${relative}:${nama}`)
      }
    }

    expect(tanpaPlafon).toEqual([])
  })

  it('menutup jalur bacanya, bukan cuma satu berkas', async () => {
    const terjaga: string[] = []
    for (const relative of BERKAS_BACA_ADMIN) {
      const source = await readFile(path.join(process.cwd(), relative), 'utf8')
      if (source.includes('requireAdminRead()')) terjaga.push(relative)
    }

    // `admin-grants.ts` hanya menulis; bacanya (`readAdminActions`) selalu lewat
    // `getAdminUserDetail` yang sudah berplafon, jadi ia tidak ikut dihitung.
    expect(terjaga.length).toBe(BERKAS_BACA_ADMIN.length - 1)
  })
})
