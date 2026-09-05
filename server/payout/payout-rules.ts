import { withdrawalMinActiveReferrals, withdrawalRequiresPremium } from '../../domain/economy/economy.ts'
import { withdrawalCooldownMs } from '../../domain/economy/premium.ts'

/** Dulu konstanta `= 5`. Sekarang setelan panel admin (`withdrawalMinActiveReferrals`), karena ia syarat penarikan yang paling menentukan siapa yang boleh menarik sama sekali — dan satu-satunya yang tidak bisa diuji tanpa deploy. Nilai 0 membuka penarikan untuk user tanpa referral; gerbang berbayarnya dipegang `payoutRequiresPremium()`, yang tidak bisa dilewati dengan menggenjot task. Tetap fungsi, bukan konstanta modul: konfigurasinya baru terpasang setelah `loadEconomyConfig()`, jadi membacanya saat modul dimuat akan membekukan nilai bawaan alih-alih yang tersimpan di database. */
export function requiredActiveReferrals(): number {
  return withdrawalMinActiveReferrals()
}

/** Apakah premium sedang diwajibkan untuk menarik. Menggantikan syarat hari aktif, yang dicabut
 * karena gerbangnya bergeser: premium menuntut biaya nyata per akun, dan itu penghalang pabrik akun
 * yang jauh lebih mahal daripada menunggu tujuh hari — pabrik akun memang cuma perlu menunggu.
 * Konsekuensinya user jujur kehilangan gerbang waktu yang dulu menahan penarikan pertama; yang
 * menggantikannya adalah ambang saldo dan referral aktif, keduanya tetap menuntut task betulan.
 * Tetap fungsi, bukan konstanta modul: nilainya baru terpasang setelah `loadEconomyConfig()`. */
export function payoutRequiresPremium(): boolean {
  return withdrawalRequiresPremium()
}

/** Jeda antar penarikan untuk user biasa. Versi premium-nya ada di `withdrawalCooldownMs`. */
export function withdrawalCooldownMsForBase(): number {
  return withdrawalCooldownMs(false)
}
