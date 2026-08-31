import { WITHDRAWAL_COOLDOWN_DAYS } from '../domain/premium.ts'

export const REQUIRED_ACTIVE_REFERRALS = 5

/**
 * Hari aktif yang harus dikumpulkan sebelum penarikan pertama bisa diajukan — hari yang
 * pernah ada minimal satu task selesai, **tidak harus berturut-turut**. Sengaja bukan umur
 * akun: pabrik akun cuma perlu menunggu, sedangkan hari aktif menuntut task betulan di tujuh
 * hari terpisah. Sengaja juga bukan streak: satu hari bolong tidak menghapus progres user
 * jujur. Batas harinya WIB, sama seperti seluruh konsep "hari" di repo ini.
 */
export const REQUIRED_ACTIVE_DAYS = 7
export const WITHDRAWAL_COOLDOWN_MS = WITHDRAWAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
