'use client'

export type GigaPubShow = () => Promise<unknown>

const SDK_WAIT_MS = 8_000

/** Giga.pub dapat menolak Promise dengan string, Error, atau objek bermessage. */
export function gigaPubFailureReason(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

/** Giga.pub memasang satu fungsi global tetap. Nilainya divalidasi sebelum dipanggil agar kegagalan memuat SDK tidak berubah menjadi TypeError. */
export function readGigaPubShow(): GigaPubShow | undefined {
  const candidate = (globalThis as unknown as { showGiga?: unknown }).showGiga
  return typeof candidate === 'function' ? (candidate as GigaPubShow) : undefined
}

const SDK_POLL_MS = 200

/** Menunggu loader `afterInteractive` selesai pada jaringan seluler/WebView Telegram. */
export async function waitForGigaPubShow(
  timeoutMs: number = SDK_WAIT_MS,
): Promise<GigaPubShow | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const show = readGigaPubShow()
    if (show) return show
    if (Date.now() >= deadline) return null
    await new Promise((resolve) => setTimeout(resolve, SDK_POLL_MS))
  }
}
