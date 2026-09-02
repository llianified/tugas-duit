/**
 * Zone rewarded interstitial default dari dashboard Monetag. Dipakai kalau
 * NEXT_PUBLIC_MONETAG_ZONE_ID tidak diset, supaya dev lokal dan deploy lama tetap
 * punya iklan yang jalan tanpa menambah env baru. Nilai ini juga yang menentukan nama
 * fungsi global SDK-nya (`show_<zone>`), jadi angkanya harus sama di script tag dan
 * di pemanggilnya.
 *
 * Sengaja berdiri sebagai modul daun TANPA import apa pun. `server/env.ts` memakainya,
 * dan env.ts ikut dimuat oleh script CLI di `scripts/` yang dijalankan Node langsung
 * dengan --experimental-strip-types. Node tidak mengerti alias `@/...` dari tsconfig,
 * jadi begitu env.ts menarik modul yang (lewat rantai importnya) memakai alias, semua
 * script mati dengan ERR_MODULE_NOT_FOUND — termasuk `db:migrate` dan migrasi
 * otomatis lewat `vercel-build`. Jangan tambahkan import ke file ini.
 */
export const MONETAG_DEFAULT_ZONE_ID = '11615417'
