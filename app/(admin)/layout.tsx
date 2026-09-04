import type { Metadata, Viewport } from 'next'
import { Geist, Plus_Jakarta_Sans } from 'next/font/google'
import '../globals.css'

/** Root layout kedua, terpisah dari Mini App. Panel admin menyetujui uang — koreksi saldo,
 * penandaan payout lunas, pemberian hak admin — jadi ia tidak boleh menjalankan satu pun skrip
 * pihak ketiga: SDK iklan yang dieksekusi di halaman ini berjalan same-origin dengan cookie sesi
 * admin, dan setiap penjagaan yang ada (`assertSameOrigin`, `requireAdmin`) memang dirancang
 * meloloskan permintaan same-origin. Font tetap `next/font` karena berkasnya di-host sendiri,
 * bukan ditarik dari Google saat runtime. CSP-nya dicabangkan di `proxy.ts`. */

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
})

export const metadata: Metadata = {
  title: 'Payout — Tugas Duit',
  robots: 'noindex, nofollow',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#101014',
  width: 'device-width',
  initialScale: 1,
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${plusJakartaSans.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="antialiased font-sans">
        <div className="min-h-dvh bg-background">{children}</div>
      </body>
    </html>
  )
}
