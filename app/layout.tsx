import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Geist, Plus_Jakarta_Sans } from 'next/font/google'
import Script from 'next/script'
import { MONETAG_DEFAULT_ZONE_ID, monetagSdkName } from '@/domain/ads'
import { ADS_HINT_INIT_SCRIPT } from '@/shell/ads-hint'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

// Font display (heading + angka). Body tetap tumpukan sistem lewat `--font-sans`.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
})

export const metadata: Metadata = {
  title: 'Tugas Duit',
  description:
    'Kerjakan soal singkat berhadiah credit, kumpulkan, lalu tukar jadi Rupiah. Lengkap dengan riwayat task, statistik, dan program referral.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  // Gelap-saja: tidak ada toggle dan tidak ada varian terang, jadi `colorScheme` | dikunci supaya kontrol bawaan browser (scrollbar, form) ikut gelap.
  colorScheme: 'dark',
  themeColor: '#101014',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  // Cerminan `resolveAdProvider()`: zone yang sama harus dipakai di script tag dan di | `useAdPass`, karena nama fungsi global SDK-nya diturunkan dari zone itu.
  const monetagZoneId = process.env.NEXT_PUBLIC_MONETAG_ZONE_ID?.trim() || MONETAG_DEFAULT_ZONE_ID

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${plusJakartaSans.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: ADS_HINT_INIT_SCRIPT }} />
      </head>
      <body className="antialiased font-sans">
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
        <Script
          src="https://libtl.com/sdk.js"
          // `lazyOnload` menunda SDK sampai window `load`; di jaringan seluler dalam | WebView Telegram itu sering lewat dari jendela tunggu 8s di `useAdPass`, | jadi fungsi `show_<zone>` belum ada saat tombol ditekan.
          strategy="afterInteractive"
          nonce={nonce}
          data-zone={monetagZoneId}
          data-sdk={monetagSdkName(monetagZoneId)}
        />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <SpeedInsights />
      </body>
    </html>
  )
}
