import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Laju polling di klien dan plafon `checkRateLimit` di route-nya adalah SATU aturan
 * yang ditulis di dua berkas. Selisih di antara keduanya tidak pernah muncul saat
 * membaca salah satunya: kodenya benar di kedua sisi, dan yang salah cuma
 * perbandingan aritmetiknya.
 *
 * Dua kali kejadian yang mendasari berkas ini:
 *
 * - Dialog QRIS premium memoll `/api/session` tiap 6 detik tanpa henti — 600
 *   permintaan per jam melawan plafon 100 — jadi plafonnya habis dalam sepuluh
 *   menit. Yang ikut mati bukan cuma dialognya melainkan setiap penyegaran saldo,
 *   energi, dan stok reward di seluruh app, untuk user yang justru baru saja
 *   membayar. SWR menahan data lama, jadi tidak ada satu pun layar yang menyatakan
 *   ada yang salah.
 * - Umpan aktivitas memoll `/api/activity` tiap 15 detik — 240 permintaan per jam
 *   melawan plafon 120 — jadi umpannya berhenti hidup setelah setengah jam.
 *
 * Yang diperiksa di sini perbandingannya, bukan angkanya: menaikkan laju polling
 * tanpa menaikkan plafonnya (atau sebaliknya) gagal di sini, bukan di produksi.
 */

const ROOT = path.resolve(import.meta.dirname, '..')

const read = (relative: string) => readFile(path.join(ROOT, relative), 'utf8')

const toNumber = (raw: string) => Number(raw.replaceAll('_', ''))

function constantOf(source: string, name: string): number {
  const match = source.match(new RegExp(`const ${name} = ([0-9_]+)`))
  if (!match) throw new Error(`Konstanta ${name} tidak ditemukan`)
  return toNumber(match[1])
}

/** Plafon per jam dari pemanggilan `checkRateLimit` pada bucket tertentu. */
function hourlyLimitOf(source: string, bucket: string): number {
  const match = source.match(
    new RegExp(`checkRateLimit\\(\`${bucket}:\\$\\{[^}]+\\}\`, ([0-9_]+), ([0-9_]+)\\)`),
  )
  if (!match) throw new Error(`Plafon untuk bucket ${bucket} tidak ditemukan`)
  const [, limit, windowSeconds] = match
  expect(toNumber(windowSeconds)).toBe(3_600)
  return toNumber(limit)
}

describe('RL-3 — laju polling klien harus muat di plafon route-nya', () => {
  it('umpan aktivitas memoll di bawah plafon /api/activity, dengan sisa', async () => {
    const pollMs = constantOf(await read('shell/use-session-queries.ts'), 'ACTIVITY_POLL_MS')
    const limit = hourlyLimitOf(await read('app/api/activity/route.ts'), 'activity')

    const perHour = 3_600_000 / pollMs
    expect(perHour).toBeLessThanOrEqual(limit)

    /** Sisa untuk `revalidateOnFocus` dan pemasangan ulang komponen. Plafon yang
     *  persis sama dengan laju pollingnya tidak menyisakan apa pun, dan permintaan
     *  pertama di luar interval sudah menabraknya. */
    expect(limit).toBeGreaterThanOrEqual(perHour * 1.25)
  })

  it('lembar QRIS premium tidak boleh menghabiskan jatah /api/session', async () => {
    const sheet = await read('features/premium/components/premium-sheet.tsx')
    const budget = constantOf(sheet, 'POLL_BUDGET')
    const limit = hourlyLimitOf(await read('app/api/session/route.ts'), 'session')

    /** Seluruh app memakai bucket `session` yang sama — setiap task selesai
     *  memicu satu `mutateSession()`. Lembar ini paling banyak boleh mengambil
     *  separuh jatahnya. */
    expect(budget).toBeLessThanOrEqual(limit / 2)
  })

  it('polling QRIS berhenti sendiri, tidak berjalan selama lembarnya terbuka', async () => {
    const sheet = await read('features/premium/components/premium-sheet.tsx')

    // Anggaran permintaan yang benar-benar dipakai, bukan cuma dideklarasikan.
    expect(sheet).toContain('spent >= POLL_BUDGET')
    // Tagihan yang lewat umurnya tidak akan berubah jadi lunas lewat polling.
    expect(sheet).toContain('Date.now() >= invoice.expiresAt')
    expect(sheet).toContain('clearInterval(timer)')
  })
})
