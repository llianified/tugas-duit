'use client'

/**
 * Palang antara dua pemakai zone Monetag yang sama.
 *
 * Iklan berhadiah (`use-ad-pass.ts`) dan interstitial otomatis (`use-in-app-ads.ts`)
 * memanggil fungsi global yang sama, `show_<zone>`. Kalau keduanya menayangkan bersamaan,
 * yang rugi selalu sisi berhadiah: Promise-nya reject, `/api/ads/claim` tidak pernah
 * dipanggil, dan tiket yang sudah ditonton user hangus tanpa credit. Interstitial tidak
 * punya kerugian setara — dia cuma tayang lebih lambat.
 *
 * Karena itu palangnya tidak simetris:
 * - selama berhadiah aktif, interstitial menahan jadwalnya (`isRewardedActive`);
 * - selama interstitial tayang, berhadiah menunggu sebentar sampai selesai
 *   (`waitForInAppIdle`) sebelum memanggil SDK.
 *
 * State-nya sengaja tingkat modul, bukan React context: kedua sisi hidup di pohon yang
 * sama tapi tidak punya hubungan induk-anak, dan palangnya harus tetap berlaku walau
 * salah satu komponennya sedang tidak ter-render.
 */

let rewardedDepth = 0
let inAppDepth = 0

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Dipakai `useSyncExternalStore`-style oleh interstitial untuk ikut perubahan palang. */
export function subscribeAdGate(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function isRewardedActive(): boolean {
  return rewardedDepth > 0
}

export function isInAppActive(): boolean {
  return inAppDepth > 0
}

/**
 * Pakai bentuk `begin`/`end` berpasangan lewat `try/finally`, bukan boolean yang di-set
 * dua tempat: kalau tontonan gagal di tengah, palangnya harus tetap turun.
 *
 * Penghitung, bukan boolean, supaya dua pemanggil yang tumpang-tindih tidak saling
 * membuka palang lebih awal.
 */
export function beginRewarded(): void {
  rewardedDepth += 1
  emit()
}

export function endRewarded(): void {
  rewardedDepth = Math.max(0, rewardedDepth - 1)
  emit()
}

export function beginInApp(): void {
  inAppDepth += 1
  emit()
}

export function endInApp(): void {
  inAppDepth = Math.max(0, inAppDepth - 1)
  emit()
}

const IN_APP_IDLE_POLL_MS = 150

/**
 * Menunggu interstitial yang sedang tayang selesai, dengan plafon waktu.
 *
 * Plafonnya ada karena `show_<zone>()` tidak dijamin pernah settle — kalau kreatifnya
 * menggantung, tanpa plafon tombol berhadiah ikut menggantung selamanya. Lewat plafon,
 * sisi berhadiah tetap jalan: tabrakan iklan lebih baik daripada tombol yang mati.
 */
export async function waitForInAppIdle(timeoutMs = 6_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (isInAppActive() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, IN_APP_IDLE_POLL_MS))
  }
}
