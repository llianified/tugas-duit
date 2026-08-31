'use client'

type TelegramShareWebApp = {
  openTelegramLink?: (url: string) => void
  isVersionAtLeast?: (version: string) => boolean
}

function telegramWebApp(): TelegramShareWebApp | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { Telegram?: { WebApp?: TelegramShareWebApp } }).Telegram?.WebApp
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed'

/**
 * Tiga jalur berbagi, dicoba berurutan, karena tidak ada satu pun yang tersedia di semua
 * tempat aplikasi ini dibuka.
 *
 * 1. `navigator.share` — satu-satunya yang bisa menembus ke luar Telegram (WhatsApp,
 *    Instagram, TikTok). Inilah yang sebenarnya dibutuhkan: tautan referral yang tidak
 *    pernah keluar dari Telegram cuma beredar di antara orang yang sudah memakai app ini.
 *    Tidak ada di WebView iOS lama dan di desktop tanpa dukungan, jadi tidak bisa berdiri
 *    sendiri.
 * 2. `openTelegramLink` ke `t.me/share/url` — lembar berbagi milik Telegram sendiri
 *    (chat, channel, Stories). Selalu ada di dalam Mini App, tapi hanya menjangkau
 *    Telegram.
 * 3. Papan klip — bukan berbagi, tapi lebih baik daripada tombol yang tidak melakukan
 *    apa pun. Pemanggil memakai nilai balik `copied` untuk mengubah labelnya.
 *
 * `AbortError` dari `navigator.share` berarti user menutup lembarnya sendiri. Itu bukan
 * kegagalan dan tidak boleh jatuh ke jalur berikutnya — memaksa lembar Telegram terbuka
 * setelah user baru saja membatalkan justru terasa seperti aplikasi yang tidak mendengar.
 */
export async function shareLink(input: {
  url: string
  text: string
  title?: string
}): Promise<ShareOutcome> {
  const { url, text, title } = input
  if (!url) return 'failed'

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, text, title })
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'dismissed'
    }
  }

  const telegram = telegramWebApp()
  if (telegram?.openTelegramLink) {
    const target = new URL('https://t.me/share/url')
    target.searchParams.set('url', url)
    target.searchParams.set('text', text)
    telegram.openTelegramLink(target.toString())
    return 'shared'
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
