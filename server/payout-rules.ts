import { withdrawalMinActiveReferrals } from '../domain/economy.ts'
import { WITHDRAWAL_COOLDOWN_DAYS } from '../domain/premium.ts'

/**
 * Dulu konstanta `= 5`. Sekarang setelan panel admin (`withdrawalMinActiveReferrals`),
 * karena ia syarat penarikan yang paling menentukan siapa yang boleh menarik sama
 * sekali — dan satu-satunya yang tidak bisa diuji tanpa deploy. Nilai 0 membuka
 * penarikan untuk user tanpa referral; gerbang waktunya tetap dipegang
 * `REQUIRED_ACTIVE_DAYS`, yang tidak bisa dipercepat dengan menggenjot task.
 *
 * Tetap fungsi, bukan konstanta modul: konfigurasinya baru terpasang setelah
 * `loadEconomyConfig()`, jadi membacanya saat modul dimuat akan membekukan nilai
 * bawaan alih-alih yang tersimpan di database.
 */
export function requiredActiveReferrals(): number {
  return withdrawalMinActiveReferrals()
}

/**
 * Hari aktif yang harus dikumpulkan sebelum penarikan pertama bisa diajukan — hari yang
 * pernah ada minimal satu task selesai, **tidak harus berturut-turut**. Sengaja bukan umur
 * akun: pabrik akun cuma perlu menunggu, sedangkan hari aktif menuntut task betulan di tujuh
 * hari terpisah. Sengaja juga bukan streak: satu hari bolong tidak menghapus progres user
 * jujur. Batas harinya WIB, sama seperti seluruh konsep "hari" di repo ini.
 */
export const REQUIRED_ACTIVE_DAYS = 7
export const WITHDRAWAL_COOLDOWN_MS = WITHDRAWAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
