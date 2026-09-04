import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shell/api-client'
import { isChallengeEndedError } from './use-captcha-attempt'

const ROOT = path.resolve(import.meta.dirname, '../../..')

/**
 * Setiap penolakan `/api/task/submit` selain "jawabannya salah" dijawab dengan status 4xx,
 * jadi `sendJson` melemparnya sebagai `ApiError` dan tidak pernah sampai ke cabang
 * `attemptsLeft` di `useCaptchaAttempt`. Sebelum daftar ini ada, semua kode itu berhenti di
 * satu toast: soalnya sudah tutup di server, sementara layar task tetap memasang tombol "Cek"
 * yang dijamin gagal setiap kali ditekan — dan di view task nav pill sedang disembunyikan,
 * jadi satu-satunya jalan keluar tinggal tombol back Telegram.
 *
 * Yang diperiksa di sini pasangannya, bukan daftarnya: menambah penolakan baru di route tanpa
 * memasukkannya ke daftar gagal di sini, bukan di produksi.
 */
const RETRYABLE = new Set([
  // Body yang tidak terbaca bukan keadaan soal; klien selalu menyusunnya sendiri.
  'VALIDATION_FAILED',
])

describe('CAPTCHA-1 — soal yang sudah tutup harus menawarkan soal baru, bukan tombol Cek', () => {
  it('mengenali setiap penolakan /api/task/submit yang menutup soalnya', async () => {
    const source = await readFile(path.join(ROOT, 'app/api/task/submit/route.ts'), 'utf8')
    const codes = [...source.matchAll(/apiError\(\s*'([A-Z_]+)'/g)].map((match) => match[1])

    expect(codes.length).toBeGreaterThan(5)

    const unhandled = codes
      .filter((code) => !RETRYABLE.has(code))
      .filter((code) => !isChallengeEndedError(new ApiError('x', code, 409)))

    expect(unhandled, unhandled.join(', ')).toEqual([])
  })

  it('tidak menutup soal untuk kegagalan yang justru layak dicoba lagi', () => {
    for (const code of ['RATE_LIMITED', 'INTERNAL', 'VALIDATION_FAILED']) {
      expect(isChallengeEndedError(new ApiError('x', code, 500))).toBe(false)
    }
  })

  it('mengabaikan kegagalan yang bukan jawaban server sama sekali', () => {
    expect(isChallengeEndedError(new TypeError('Failed to fetch'))).toBe(false)
    expect(isChallengeEndedError(null)).toBe(false)
  })
})
