'use client'

export type AdShow = () => Promise<unknown>

/** OnClicka tidak memasang fungsi show global seperti Giga.pub. Yang global cuma `initCdTma`;
 * fungsi show-nya lahir dari Promise hasil init untuk satu spot tertentu. */
type InitCdTma = (options: { id: number | string }) => Promise<unknown>

const SDK_WAIT_MS = 8_000
const SDK_POLL_MS = 200

/** SDK dapat menolak Promise dengan string, Error, atau objek bermessage. */
export function adFailureReason(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

/** Nilainya divalidasi sebelum dipanggil agar kegagalan memuat SDK tidak berubah menjadi TypeError. */
export function readInitCdTma(): InitCdTma | undefined {
  const candidate = (globalThis as unknown as { initCdTma?: unknown }).initCdTma
  return typeof candidate === 'function' ? (candidate as InitCdTma) : undefined
}

/** Menunggu loader `afterInteractive` selesai pada jaringan seluler/WebView Telegram. */
async function waitForInitCdTma(deadline: number): Promise<InitCdTma | null> {
  for (;;) {
    const init = readInitCdTma()
    if (init) return init
    if (Date.now() >= deadline) return null
    await new Promise((resolve) => setTimeout(resolve, SDK_POLL_MS))
  }
}

/** Spot dashboard-nya numerik; string dikirim apa adanya kalau ternyata bukan angka. */
function spotArgument(spotId: string): number | string {
  const numeric = Number(spotId)
  return Number.isFinite(numeric) && spotId.trim() !== '' ? numeric : spotId
}

/** Init cukup sekali per sesi: hasilnya fungsi show yang boleh dipanggil berulang. Memanggil
 * `initCdTma` tiap tontonan membuat SDK memasang engine ganda untuk spot yang sama. */
let sdkReady: Promise<AdShow | null> | null = null

/** Dipakai test dan pemulihan setelah init gagal; tanpa ini satu kegagalan awal (misalnya SDK
 * diblokir CSP saat halaman baru dibuka) mengunci rewarded sampai user memuat ulang aplikasi. */
export function resetOnclickaSdk(): void {
  sdkReady = null
}

async function initOnclicka(spotId: string, timeoutMs: number): Promise<AdShow | null> {
  const init = await waitForInitCdTma(Date.now() + timeoutMs)
  if (!init) return null
  try {
    const show = await init({ id: spotArgument(spotId) })
    return typeof show === 'function' ? (show as AdShow) : null
  } catch {
    return null
  }
}

export async function waitForOnclickaShow(
  spotId: string,
  timeoutMs: number = SDK_WAIT_MS,
): Promise<AdShow | null> {
  sdkReady ??= initOnclicka(spotId, timeoutMs)
  const show = await sdkReady
  if (!show) sdkReady = null
  return show
}
