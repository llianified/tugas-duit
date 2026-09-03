/** INSTRUMENTASI SEMENTARA — saklar eksperimen untuk membuktikan asal interstitial in-app.
 *
 * Hapus bersama `shell/pre-sdk-ads-probe.ts` dan `shell/in-app-ads-probe.ts` setelah
 * penyebabnya terbukti.
 *
 * PERTANYAAN YANG DIJAWAB SAKLAR INI
 *
 * Ada dua jalur yang sama-sama bisa menayangkan interstitial:
 *
 *   1. SDK Monetag yang auto-start dari atribut `data-zone` + `data-sdk` di script tag.
 *   2. Panggilan eksplisit `show_<zone>({ type: 'inApp' })` dari `useInAppAds`.
 *
 * Selama keduanya hidup, tidak mungkin menunjuk mana yang menayangkan. Saklar ini
 * mematikan jalur (2) SAJA, sehingga hasilnya memisahkan dua kemungkinan:
 *
 *   interstitial MASIH muncul  -> jalur (1) aktif sendiri
 *   interstitial TIDAK muncul  -> jalur (2) yang menayangkan
 *
 * Ini alat ukur, bukan perbaikan: mematikan panggilan eksplisit juga membuang
 * konfigurasi jadwal kita (frequency/capping/interval/timeout), jadi ia TIDAK boleh
 * dinyalakan di produksi sebagai solusi. Bawaannya mati. */

/** Bawaan: `false`. Hanya `'1'` dan `'true'` yang menyalakan, supaya nilai sisa seperti
 * `'0'`, `'false'`, atau string kosong tidak pernah mengaktifkannya tanpa sengaja. */
export function skipExplicitInAppShow({
  env,
  override,
}: {
  /** Nilai `NEXT_PUBLIC_ADS_PROBE_SKIP_EXPLICIT` saat build. */
  env?: string | null
  /** Override dari localStorage untuk uji lapangan tanpa deploy ulang. Menang atas `env` — termasuk untuk MEMATIKAN saat env-nya menyala, supaya perangkat uji selalu bisa dikembalikan ke perilaku normal. */
  override?: string | null
}): boolean {
  const fromOverride = parseFlag(override)
  if (fromOverride !== null) return fromOverride
  return parseFlag(env) ?? false
}

function parseFlag(value: string | null | undefined): boolean | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false
  return null
}
