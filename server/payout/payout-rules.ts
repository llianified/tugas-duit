import { withdrawalMinActiveDays, withdrawalMinActiveReferrals } from '../../domain/economy/economy.ts'
import { withdrawalCooldownMs } from '../../domain/economy/premium.ts'

/** Dulu konstanta `= 5`. Sekarang setelan panel admin (`withdrawalMinActiveReferrals`), karena ia syarat penarikan yang paling menentukan siapa yang boleh menarik sama sekali — dan satu-satunya yang tidak bisa diuji tanpa deploy. Nilai 0 membuka penarikan untuk user tanpa referral; gerbang waktunya tetap dipegang `requiredActiveDays()`, yang tidak bisa dipercepat dengan menggenjot task. Tetap fungsi, bukan konstanta modul: konfigurasinya baru terpasang setelah `loadEconomyConfig()`, jadi membacanya saat modul dimuat akan membekukan nilai bawaan alih-alih yang tersimpan di database. */
export function requiredActiveReferrals(): number {
  return withdrawalMinActiveReferrals()
}

/** Hari aktif yang harus dikumpulkan sebelum penarikan pertama bisa diajukan — hari yang pernah ada minimal satu task selesai, **tidak harus berturut-turut**. Sengaja bukan umur akun: pabrik akun cuma perlu menunggu, sedangkan hari aktif menuntut task betulan di hari-hari terpisah. Sengaja juga bukan streak: satu hari bolong tidak menghapus progres user jujur. Batas harinya WIB, sama seperti seluruh konsep "hari" di repo ini. Dulu konstanta `= 7`. Sekarang setelan panel (`withdrawalMinActiveDays`), alasannya sama dengan `requiredActiveReferrals()` di atas: ia gerbang penarikan, dan gerbang yang tidak bisa diuji tanpa deploy adalah gerbang yang tidak pernah benar-benar disetel. Tetap fungsi, bukan konstanta modul — nilainya baru terpasang setelah `loadEconomyConfig()`. */
export function requiredActiveDays(): number {
  return withdrawalMinActiveDays()
}

/** Jeda antar penarikan untuk user biasa. Versi premium-nya ada di `withdrawalCooldownMs`. */
export function withdrawalCooldownMsForBase(): number {
  return withdrawalCooldownMs(false)
}
