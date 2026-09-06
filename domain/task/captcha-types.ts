/** Daftar tipe soal, di modul daun tanpa satu pun import.
 *
 * Bentuknya mengikuti `domain/ads/monetag-zone.ts` dan alasannya sama: `domain/task/challenge.ts`
 * mengimpor nilai dari `domain/economy/economy-config.ts` (`mathCeiling`, `textLength`, dan
 * kawan-kawannya), jadi config yang mengimpor balik daftar ini dari `challenge.ts` akan membentuk
 * siklus. Yang membutuhkannya di sana cuma satu angka — berapa jenis soal yang benar-benar ada —
 * dan angka itu tidak layak dibayar dengan siklus.
 *
 * Menambah tipe soal berarti menambahnya di sini, di `Challenge` pada `challenge.ts`, dan di enum
 * `captcha_type` lewat migrasi baru. Batas atas misi "jenis soal berbeda" ikut sendiri. */

export type CaptchaType = 'text' | 'math' | 'select' | 'order' | 'count'

export const CAPTCHA_TYPES: readonly CaptchaType[] = [
  'text',
  'math',
  'select',
  'order',
  'count',
]
