import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import { MONETAG_DEFAULT_ZONE_ID, monetagSdkName } from '@/domain/ads'
import { THEME_INIT_SCRIPT } from '@/shell/theme-init'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

export const metadata: Metadata = {
  title: 'Tugas Duit',
  description: 'Task CAPTCHA berhadiah credit, dengan riwayat task dan program referral.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#101014' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  // Cerminan `resolveAdProvider()`: zone yang sama harus dipakai di script tag dan di
  // `useAdPass`, karena nama fungsi global SDK-nya diturunkan dari zone itu.
  const monetagZoneId = process.env.NEXT_PUBLIC_MONETAG_ZONE_ID?.trim() || MONETAG_DEFAULT_ZONE_ID

  return (
    <html lang="id" className={`${geistSans.variable} bg-background`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased font-sans">
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
        <Script
          src="https://libtl.com/sdk.js"
          // `lazyOnload` menunda SDK sampai window `load`; di jaringan seluler dalam
          // WebView Telegram itu sering lewat dari jendela tunggu 8s di `useAdPass`,
          // jadi fungsi `show_<zone>` belum ada saat tombol ditekan.
          strategy="afterInteractive"
          nonce={nonce}
          data-zone={monetagZoneId}
          data-sdk={monetagSdkName(monetagZoneId)}
        />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
