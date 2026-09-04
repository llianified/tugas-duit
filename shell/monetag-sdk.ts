'use client'

import type { InAppShowParams } from '@/domain/ads/in-app-ads'

export interface RewardedShowParams {
  /** Rewarded interstitial eksplisit; berbeda dari penjadwal otomatis `inApp`. */
  type: 'end'
  /** ID unik per kesempatan reward untuk deduplikasi dan atribusi provider. */
  ymid: string
  /** Label placement yang muncul pada laporan provider. */
  requestVar: 'task_ticket'
  /** Minta SDK menolak Promise saat inventory kosong agar UI tidak menggantung. */
  catchIfNoFeed: true
}

export type MonetagShowParams = InAppShowParams | RewardedShowParams

/** Akses ke SDK Monetag. SDK menempel satu fungsi global per zone dari atribut `data-sdk` di `app/(miniapp)/layout.tsx`, dengan bentuk `show_<zone>`. */
export type MonetagShow = (params?: MonetagShowParams) => Promise<unknown>

export function rewardedShowParams(ticketId: string): RewardedShowParams {
  return {
    type: 'end',
    ymid: ticketId,
    requestVar: 'task_ticket',
    catchIfNoFeed: true,
  }
}

/** Membekukan identitas tiket ke satu tayangan. Pemanggil lalu hanya dapat menjalankan Promise rewarded yang sudah dikonfigurasi dengan benar. */
export function rewardedPlayer(show: MonetagShow, ticketId: string): () => Promise<unknown> {
  const params = rewardedShowParams(ticketId)
  return () => show(params)
}

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
