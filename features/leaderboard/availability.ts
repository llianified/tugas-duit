import { economyConfig } from '@/domain/economy-config'

/**
 * Dulu `export const LEADERBOARD_ENABLED = true` — satu konstanta yang menuntut deploy untuk
 * menyalakan atau mematikan seluruh view Peringkat beserta umpan aktivitasnya.
 *
 * Sekarang fungsi, bukan konstanta, dan itu penting: nilainya baru terpasang setelah
 * `loadEconomyConfig()` di server atau setelah payload `/api/session` mendarat di klien.
 * Membekukannya ke `const` tingkat modul akan mengunci nilai bawaan alih-alih yang tersimpan
 * di database — jebakan yang sama dengan `requiredActiveReferrals()` di `payout-rules.ts`.
 */
export function leaderboardEnabled(): boolean {
  return economyConfig().leaderboardEnabled > 0
}
