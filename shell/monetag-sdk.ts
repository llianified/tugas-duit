'use client'

import type { InAppShowParams } from '@/domain/ads/in-app-ads'

/** Akses ke SDK Monetag, dipakai dua pemanggil: `use-ad-pass.ts` (iklan berhadiah, dipicu tombol) dan `use-in-app-ads.ts` (interstitial otomatis). Keduanya butuh fungsi global yang sama, jadi pembacaan dan penungguannya ditaruh di sini supaya tidak ada dua versi jendela tunggu yang bisa berbeda diam-diam. SDK-nya hanya menempel satu fungsi global per zone — namanya diambil dari atribut `data-sdk` di script tag (lihat `app/layout.tsx`), jadi bentuknya `show_<zone>`. Rewarded memanggilnya tanpa parameter setiap kali user memilih menonton; konfigurasi `inApp` hanya dikirim sekali agar SDK tidak membuat penjadwal otomatis ganda. */
export type MonetagShow = (params?: InAppShowParams) => Promise<unknown>

/** Nama fungsinya baru diketahui saat runtime (`show_<zone>`), jadi pembacaannya lewat indeks — bukan properti bernama pada `Window`. `unknown` dulu, baru dipastikan callable, supaya SDK yang belum termuat atau berubah bentuk tidak lolos jadi `TypeError`. */
export function readShow(name: string): MonetagShow | undefined {
  const candidate = (globalThis as unknown as Record<string, unknown>)[name]
  return typeof candidate === 'function' ? (candidate as MonetagShow) : undefined
}

const SDK_POLL_MS = 200

/** Jendela tunggu default: cukup panjang untuk jaringan seluler di WebView Telegram. */
export const SDK_WAIT_MS = 8_000

/** Menunggu SDK muncul, karena script tag-nya `afterInteractive` — fungsinya belum tentu ada saat komponen pertama kali dirender. */
export async function waitForShow(
  name: string,
  timeoutMs: number = SDK_WAIT_MS,
): Promise<MonetagShow | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const show = readShow(name)
    if (show) return show
    if (Date.now() >= deadline) return null
    await new Promise((resolve) => setTimeout(resolve, SDK_POLL_MS))
  }
}

/** Monetag tidak menjanjikan bentuk error tertentu — kadang string, kadang `Error`, kadang objek. Alasannya diringkas apa adanya supaya penyebab sebenarnya (stok kosong, diblokir, ditutup lebih awal) tidak hilang di balik satu pesan generik. */
export function showFailureReason(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}
